/**
 * Dos registros brutos à decisão: métricas por candidato, notas 0–1 por dimensão,
 * score composto, sensibilidade aos pesos, fronteira de Pareto e projeção de custo.
 * Funções puras — o mesmo cache sempre gera o mesmo relatório.
 */
import { ANCHORS, BUSINESS, MIN_FORCED_TOOL_COMPLIANCE, type Candidate, type Weights } from "./config";
import type { GateResult } from "./gate";
import { CRITERIA } from "./geval";
import type { Pricing } from "./openrouter";
import type { ConversationRecord, Judgment, TurnRecord } from "./records";
import { bootstrapMean, mean, percentile, randomWeights, seededRandom, spearman, type Interval } from "./stats";

export interface DimensionScores {
  effectiveness: number;
  quality: number;
  latency: number;
  cost: number;
}

export interface CandidateSummary {
  key: string;
  label: string;
  model: string;
  tier: Candidate["tier"];
  effort: string;
  status: "avaliado" | "desqualificado" | "sem dados";
  disqualifiedReason: string | null;
  conversations: number;
  turns: number;
  passRate: Interval;
  scenarioPasses: Record<string, { passed: number; total: number }>;
  /** Turnos em que a 1ª tool foi recordUnderstanding (passo 0 forçado). */
  forcedToolCompliance: number;
  /** Tools pedidas pelo modelo que não chegaram a executar (nome/argumento inválido). */
  toolCallErrorRate: number;
  turnErrorRate: number;
  rateLimitRetries: number;
  latency: { p50: number; p95: number; ttftP50: number };
  cost: { totalUsd: number; perTurnUsd: number; perAtendimentoUsd: number; per1000AtendimentosUsd: number };
  usage: { callsPerTurn: number; inputTokensPerTurn: number; outputTokensPerTurn: number; reasoningTokensPerTurn: number };
  providers: Record<string, number>;
  quality: { overall: Interval; byCriterion: Record<string, number>; byJudge: Record<string, number> };
  cache: CacheStats;
  /** `compositeNoCache` = mesmo score se o provedor não tivesse cache (custo contrafactual). */
  scores: (DimensionScores & { composite: number; compositeNoCache: number }) | null;
}

export interface CacheStats {
  /** Tokens de entrada lidos do cache ÷ tokens de entrada. */
  hitRate: number;
  /** Quanto o cache do provedor economizou (leitura com desconto menos o extra de escrita). */
  savedUsd: number;
  /** O que o benchmark teria custado sem cache (cobrado + economizado). */
  noCacheTotalUsd: number;
  noCachePerAtendimentoUsd: number;
  /** Mediana da duração das chamadas sem nada do cache × com parte do prompt do cache. */
  coldCallMs: number;
  warmCallMs: number;
  coldCalls: number;
  warmCalls: number;
}

/**
 * Economia do cache numa chamada, pelos preços do catálogo: tokens lidos do cache
 * custam `input_cache_read` em vez de `prompt`; escrever no cache pode custar mais
 * que o `prompt` (ex.: 1,25× na OpenAI a partir do GPT-5.6).
 */
export function cacheSavingsUsd(call: { cachedTokens: number; cacheWriteTokens: number }, pricing: Pricing | undefined): number {
  if (!pricing) return 0;
  const read = pricing.input_cache_read ?? pricing.prompt;
  const write = pricing.input_cache_write ?? pricing.prompt;
  return call.cachedTokens * (pricing.prompt - read) - call.cacheWriteTokens * Math.max(0, write - pricing.prompt);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Latência p50 por turno → 0–1 (âncoras absolutas em config). */
export function latencyScore(p50Ms: number): number {
  const { best, worst } = ANCHORS.latencyMs;
  return clamp01((worst - p50Ms) / (worst - best));
}

/** Custo por atendimento → 0–1 em escala log (cada 10x mais barato vale o mesmo tanto). */
export function costScore(usdPerAtendimento: number): number {
  const { best, worst } = ANCHORS.costPerAtendimentoUsd;
  if (usdPerAtendimento <= 0) return 1;
  return clamp01((Math.log10(worst) - Math.log10(usdPerAtendimento)) / (Math.log10(worst) - Math.log10(best)));
}

export function compositeScore(scores: DimensionScores, weights: Weights): number {
  return (
    weights.effectiveness * scores.effectiveness +
    weights.quality * scores.quality +
    weights.latency * scores.latency +
    weights.cost * scores.cost
  );
}

/** Nota do painel por critério numa conversa: média dos juízes que deram nota. */
export function panelScores(judgments: Judgment[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const c of CRITERIA) {
    const values = judgments.map((j) => j.scores[c.id]).filter((v): v is number => v !== undefined);
    if (values.length) result[c.id] = mean(values);
  }
  return result;
}

/**
 * 1ª tool do turno: a do trace. Se o provedor caiu no meio do turno, o trace não fecha; vale então
 * a tool que o modelo pediu na 1ª chamada que respondeu (queda de provedor não é desobediência do modelo).
 */
function stepZeroTool(turn: TurnRecord): string | null {
  if (!turn.error) return turn.firstTool;
  return turn.llmCalls.find((call) => call.status === 200 && !call.error)?.toolCalls[0] ?? null;
}

export function summarizeCandidate(
  candidate: Candidate,
  conversations: ConversationRecord[],
  judgments: Judgment[],
  gate: GateResult | undefined,
  weights: Weights,
  pricing?: Pricing,
): CandidateSummary {
  const turns = conversations.flatMap((c) => c.turns);
  const answered = turns.filter((t) => t.llmCalls.some((call) => call.status === 200 && !call.error));
  const okTurns = turns.filter((t) => !t.error);
  const calls = turns.flatMap((t) => t.llmCalls);

  const compliance = answered.length ? answered.filter((t) => stepZeroTool(t) === "recordUnderstanding").length / answered.length : 0;
  // Só turnos que terminaram: num turno em que o provedor caiu, as tools pedidas não chegam a executar.
  const requested = okTurns.flatMap((t) => t.llmCalls).reduce((sum, c) => sum + c.toolCalls.length, 0);
  const executed = okTurns.reduce((sum, t) => sum + t.toolCalls.length, 0);
  const totalUsd = calls.reduce((sum, c) => sum + c.costUsd, 0) + conversations.reduce((sum, c) => sum + c.discardedCostUsd, 0);
  const perTurnUsd = turns.length ? totalUsd / turns.length : NaN;
  const perAtendimentoUsd = perTurnUsd * BUSINESS.turnsPerAtendimento;

  const scenarioPasses: CandidateSummary["scenarioPasses"] = {};
  for (const c of conversations) {
    const entry = (scenarioPasses[c.scenario] ??= { passed: 0, total: 0 });
    entry.total++;
    if (c.failures.length === 0) entry.passed++;
  }

  // Qualidade: média dos critérios (nota do painel) por conversa.
  const byConversation = conversations
    .map((c) => panelScores(judgments.filter((j) => j.scenario === c.scenario && j.rep === c.rep && !j.error)))
    .filter((scores) => Object.keys(scores).length === CRITERIA.length);
  const conversationQuality = byConversation.map((scores) => mean(Object.values(scores)));
  const byCriterion = Object.fromEntries(CRITERIA.map((c) => [c.id, mean(byConversation.map((s) => s[c.id]))]));
  const judgeKeys = [...new Set(judgments.map((j) => j.judge))];
  const byJudge = Object.fromEntries(
    judgeKeys.map((key) => [key, mean(judgments.filter((j) => j.judge === key && !j.error).map((j) => mean(Object.values(j.scores))))]),
  );

  const providers: Record<string, number> = {};
  for (const call of calls) if (call.provider) providers[call.provider] = (providers[call.provider] ?? 0) + 1;

  const latency = {
    p50: percentile(okTurns.map((t) => t.latencyMs), 50),
    p95: percentile(okTurns.map((t) => t.latencyMs), 95),
    ttftP50: percentile(okTurns.flatMap((t) => (t.ttftMs === null ? [] : [t.ttftMs])), 50),
  };
  const passRate = bootstrapMean(conversations.map((c) => (c.failures.length === 0 ? 1 : 0)));
  const overall = bootstrapMean(conversationQuality);

  const okCalls = calls.filter((c) => c.status === 200);
  const inputTokens = okCalls.reduce((sum, c) => sum + c.inputTokens, 0);
  const savedUsd = okCalls.reduce((sum, c) => sum + cacheSavingsUsd(c, pricing), 0);
  const noCacheTotalUsd = totalUsd + savedUsd;
  const cold = okCalls.filter((c) => c.cachedTokens === 0);
  const warm = okCalls.filter((c) => c.cachedTokens > 0);
  const cache: CacheStats = {
    hitRate: inputTokens ? okCalls.reduce((sum, c) => sum + c.cachedTokens, 0) / inputTokens : 0,
    savedUsd,
    noCacheTotalUsd,
    noCachePerAtendimentoUsd: turns.length ? (noCacheTotalUsd / turns.length) * BUSINESS.turnsPerAtendimento : NaN,
    coldCallMs: percentile(cold.map((c) => c.latencyMs), 50),
    warmCallMs: percentile(warm.map((c) => c.latencyMs), 50),
    coldCalls: cold.length,
    warmCalls: warm.length,
  };

  let status: CandidateSummary["status"] = "avaliado";
  let disqualifiedReason: string | null = null;
  if (gate && !gate.passed) {
    status = "desqualificado";
    disqualifiedReason = `pré-voo: tool_choice forçado falhou (${gate.error ?? "sem detalhe"})`;
  } else if (conversations.length === 0) {
    status = "sem dados";
  } else if (compliance < MIN_FORCED_TOOL_COMPLIANCE) {
    status = "desqualificado";
    disqualifiedReason = `só ${(compliance * 100).toFixed(0)}% dos turnos começaram por recordUnderstanding`;
  }

  const dimensions: DimensionScores | null =
    status === "avaliado" && conversationQuality.length
      ? {
          effectiveness: passRate.mean,
          quality: (overall.mean - 1) / 4,
          latency: latencyScore(latency.p50),
          cost: costScore(perAtendimentoUsd),
        }
      : null;

  return {
    key: candidate.key,
    label: candidate.label,
    model: candidate.model,
    tier: candidate.tier,
    effort: candidate.effort,
    status,
    disqualifiedReason,
    conversations: conversations.length,
    turns: turns.length,
    passRate,
    scenarioPasses,
    forcedToolCompliance: compliance,
    toolCallErrorRate: requested ? Math.max(0, requested - executed) / requested : 0,
    turnErrorRate: turns.length ? turns.filter((t) => t.error).length / turns.length : 0,
    rateLimitRetries: conversations.reduce((sum, c) => sum + c.attempts - 1, 0),
    latency,
    cost: { totalUsd, perTurnUsd, perAtendimentoUsd, per1000AtendimentosUsd: perAtendimentoUsd * 1000 },
    usage: {
      callsPerTurn: turns.length ? calls.length / turns.length : 0,
      inputTokensPerTurn: turns.length ? calls.reduce((s, c) => s + c.inputTokens, 0) / turns.length : 0,
      outputTokensPerTurn: turns.length ? calls.reduce((s, c) => s + c.outputTokens, 0) / turns.length : 0,
      reasoningTokensPerTurn: turns.length ? calls.reduce((s, c) => s + c.reasoningTokens, 0) / turns.length : 0,
    },
    providers,
    quality: { overall, byCriterion, byJudge },
    cache,
    scores: dimensions
      ? {
          ...dimensions,
          composite: compositeScore(dimensions, weights),
          compositeNoCache: compositeScore({ ...dimensions, cost: costScore(cache.noCachePerAtendimentoUsd) }, weights),
        }
      : null,
  };
}

/** Quem não é dominado: ninguém é ao mesmo tempo mais barato (ou igual) e melhor (ou igual). */
export function paretoFrontier(points: Array<{ key: string; cost: number; quality: number }>): string[] {
  return points
    .filter((p) => !points.some((q) => q !== p && q.cost <= p.cost && q.quality >= p.quality && (q.cost < p.cost || q.quality > p.quality)))
    .map((p) => p.key);
}

export interface Sensitivity {
  /** Ranking (chaves em ordem) em cada perfil de pesos. */
  profiles: Record<string, string[]>;
  /** Em quantos % de 10 mil pesos sorteados cada candidato fica em 1º. */
  winShare: Record<string, number>;
}

export function weightSensitivity(
  candidates: Array<{ key: string; scores: DimensionScores }>,
  profiles: Record<string, Weights>,
  samples = 10_000,
  seed = 7,
): Sensitivity {
  const rank = (weights: Weights) =>
    [...candidates].sort((a, b) => compositeScore(b.scores, weights) - compositeScore(a.scores, weights)).map((c) => c.key);

  const wins: Record<string, number> = Object.fromEntries(candidates.map((c) => [c.key, 0]));
  const random = seededRandom(seed);
  for (let i = 0; i < samples && candidates.length; i++) {
    const [effectiveness, quality, latency, cost] = randomWeights(4, random);
    wins[rank({ effectiveness, quality, latency, cost })[0]]++;
  }
  return {
    profiles: Object.fromEntries(Object.entries(profiles).map(([name, weights]) => [name, rank(weights)])),
    winShare: Object.fromEntries(Object.entries(wins).map(([key, count]) => [key, count / samples])),
  };
}

export interface ProjectionRow {
  employees: number;
  atendimentosPerMonth: number;
  costPerMonthUsd: number;
  costPerMonthHighUsd: number;
  humanEquivalentUsd: number;
}

/** Custo mensal do agent para N funcionários (premissas em config.BUSINESS). */
export function projectMonthlyCost(perAtendimentoUsd: number): ProjectionRow[] {
  return BUSINESS.employeeCounts.map((employees) => {
    const atendimentos = employees * BUSINESS.atendimentosPerEmployeeMonth;
    const high = employees * BUSINESS.atendimentosPerEmployeeMonthHigh;
    return {
      employees,
      atendimentosPerMonth: atendimentos,
      costPerMonthUsd: atendimentos * perAtendimentoUsd,
      costPerMonthHighUsd: high * perAtendimentoUsd,
      humanEquivalentUsd: atendimentos * BUSINESS.humanCostPerTicketUsd,
    };
  });
}

/** Concordância entre dois juízes: Spearman e diferença média absoluta das notas por conversa. */
export function judgeAgreement(judgments: Judgment[], a: string, b: string) {
  const key = (j: Judgment) => `${j.candidate}|${j.scenario}|${j.rep}`;
  const fromB = new Map(judgments.filter((j) => j.judge === b && !j.error).map((j) => [key(j), mean(Object.values(j.scores))]));
  const pairs = judgments
    .filter((j) => j.judge === a && !j.error && fromB.has(key(j)))
    .map((j) => [mean(Object.values(j.scores)), fromB.get(key(j))!] as const);
  return {
    n: pairs.length,
    spearman: spearman(
      pairs.map((p) => p[0]),
      pairs.map((p) => p[1]),
    ),
    meanAbsDiff: mean(pairs.map(([x, y]) => Math.abs(x - y))),
    meanA: mean(pairs.map((p) => p[0])),
    meanB: mean(pairs.map((p) => p[1])),
  };
}
