/**
 * Gera o relatório a partir do cache: docs/benchmark/resultados.json (dados),
 * docs/benchmark/TABELAS.md (tabelas) e os gráficos em docs/benchmark/graficos/.
 * Não chama API nenhuma. A análise escrita fica em docs/benchmark/RELATORIO.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { scenarios as coreScenarios } from "../scenarios";
import { ANCHORS as CALIBRATION_ANCHORS, calibrationPasses, type AnchorLevel } from "./calibration";
import { barChart, compositeChart, groupedBarChart, heatmap, paretoChart, rangeChart, waterfall } from "./charts";
import { ANCHORS, BUSINESS, CANDIDATES, JUDGES, WEIGHT_PROFILES, WEIGHTS } from "./config";
import type { GateResult } from "./gate";
import { CRITERIA } from "./geval";
import { loadConversations } from "./job";
import type { Pricing } from "./openrouter";
import { judgmentSchema, PATHS, readJson, readJsonl, type Judgment } from "./records";
import { prdScenarios } from "./scenarios-prd";
import { cacheSavingsUsd, judgeAgreement, paretoFrontier, projectMonthlyCost, summarizeCandidate, weightSensitivity, type CandidateSummary } from "./scoring";
import { mean } from "./stats";

const OUT_DIR = "docs/benchmark";
const CHART_DIR = `${OUT_DIR}/graficos`;

const num = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
const pct = (value: number) => (Number.isFinite(value) ? `${num(value * 100, 0)}%` : "—");
const money = (value: number, digits = 4) => (Number.isFinite(value) ? `US$ ${num(value, digits)}` : "—");
const seconds = (ms: number) => (Number.isFinite(ms) ? `${num(ms / 1000, 1)} s` : "—");
/** Dinheiro com casas decimais suficientes para valores pequenos (eixos e rótulos). */
const moneyAuto = (value: number) => `US$ ${num(value, value >= 100 ? 0 : value >= 1 ? 2 : value >= 0.01 ? 3 : 4)}`;
const statusNote = (s: CandidateSummary) =>
  s.disqualifiedReason ? `desqualificado — ${s.disqualifiedReason}` : s.status === "avaliado" ? "sem notas dos juízes" : s.status;
const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

type Scored = CandidateSummary & { scores: NonNullable<CandidateSummary["scores"]> };

export function buildReport() {
  const judgments = readJsonl(PATHS.judgments, judgmentSchema);
  const gates = readJson<Record<string, GateResult>>(PATHS.gate, {});
  const calibration = readJson<{ judges: Record<string, Record<AnchorLevel, Record<string, number>>> }>(PATHS.calibration, { judges: {} });
  const runs = readJson<Array<Record<string, number | string | null>>>(PATHS.runs, []);
  const prices = readJson<{ models: Record<string, Pricing> }>(PATHS.prices, { models: {} }).models;
  const allScenarios = [...coreScenarios, ...prdScenarios];

  const summaries = CANDIDATES.map((candidate) =>
    summarizeCandidate(
      candidate,
      loadConversations(candidate.key),
      judgments.filter((j) => j.candidate === candidate.key),
      gates[candidate.key],
      WEIGHTS,
      prices[candidate.model],
    ),
  );
  const evaluated = summaries.filter((s): s is Scored => s.scores !== null);
  const ranked = [...evaluated].sort((a, b) => b.scores.composite - a.scores.composite);
  const winner = ranked[0]?.key;
  const rankedNoCache = [...evaluated].sort((a, b) => b.scores.compositeNoCache - a.scores.compositeNoCache);
  const frontier = paretoFrontier(evaluated.map((s) => ({ key: s.key, cost: s.cost.perAtendimentoUsd, quality: s.quality.overall.mean })));
  const sensitivity = weightSensitivity(evaluated.map((s) => ({ key: s.key, scores: s.scores })), WEIGHT_PROFILES);
  const agreement = JUDGES.length >= 2 ? judgeAgreement(judgments, JUDGES[0].key, JUDGES[1].key) : null;
  const labelOf = (key: string) => summaries.find((s) => s.key === key)?.label ?? key;
  const withTurns = summaries.filter((s) => s.turns > 0);
  const judgeCache = judgeCacheStats(judgments, prices);

  // Gasto do benchmark inteiro: candidatos (com o contrafactual sem cache) + juízes + cache de respostas.
  const agentsUsd = withTurns.reduce((sum, s) => sum + s.cost.totalUsd, 0);
  const providerCacheSavedUsd =
    withTurns.reduce((sum, s) => sum + s.cache.savedUsd, 0) + judgeCache.reduce((sum, j) => sum + j.savedUsd, 0);
  const judgesUsd = judgments.reduce((sum, j) => sum + j.costUsd, 0);
  const responseCacheSavedUsd = runs.reduce((sum, r) => sum + Number(r.responseCacheSavedUsd ?? 0), 0) + judgments.reduce((sum, j) => sum + j.savedUsd, 0);

  mkdirSync(CHART_DIR, { recursive: true });
  writeCharts();

  writeFileSync(
    `${OUT_DIR}/resultados.json`,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        premissas: { weights: WEIGHTS, anchors: ANCHORS, business: BUSINESS, judges: JUDGES.map((j) => ({ key: j.key, model: j.model, method: j.method, samples: j.samples })) },
        criterios: CRITERIA,
        ranking: ranked.map((s) => s.key),
        rankingSemCache: rankedNoCache.map((s) => s.key),
        paretoFrontier: frontier,
        sensitivity,
        judgeAgreement: agreement,
        judgeCache,
        calibration,
        gates,
        runs,
        gastos: { agentsUsd, providerCacheSavedUsd, judgesUsd, responseCacheSavedUsd },
        candidates: summaries.map((s) => ({ ...s, projection: Number.isFinite(s.cost.perAtendimentoUsd) ? projectMonthlyCost(s.cost.perAtendimentoUsd) : [] })),
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(`${OUT_DIR}/TABELAS.md`, tablesMarkdown());

  console.log("\nRanking:");
  ranked.forEach((s, i) =>
    console.log(
      `  ${i + 1}. ${s.label.padEnd(32)} composto ${num(s.scores.composite, 3)} · efetividade ${pct(s.passRate.mean)} · qualidade ${num(s.quality.overall.mean)} · p50 ${seconds(s.latency.p50)} · ${money(s.cost.perAtendimentoUsd)}/atendimento · cache ${pct(s.cache.hitRate)}`,
    ),
  );
  console.log(`\nRelatório: ${OUT_DIR}/TABELAS.md · ${OUT_DIR}/resultados.json · ${CHART_DIR}/`);

  function writeCharts() {
    if (!withTurns.length) return;
    // Sem notas dos juízes ainda (execução parcial), só saem os gráficos que não dependem delas.
    const chart = (name: string, content: () => string, needsJudges = false) => {
      if (!needsJudges || evaluated.length) writeFileSync(`${CHART_DIR}/${name}.svg`, content());
    };
    const byComposite = ranked;
    const label = (s: CandidateSummary) => (s.key === winner ? `${s.label} ★` : s.label);
    const per1000 = (s: CandidateSummary) => s.cost.per1000AtendimentosUsd;

    chart(
      "01-pareto",
      () =>
        paretoChart({
        title: "Qualidade × custo: quem entrega mais por dólar",
        subtitle: "Fronteira de Pareto: nenhum outro modelo é mais barato e melhor ao mesmo tempo. ★ = maior score composto.",
        points: evaluated.map((s) => ({ label: s.label, costUsd: per1000(s), quality: s.quality.overall.mean, onFrontier: frontier.includes(s.key), highlight: s.key === winner })),
        xLabel: "Custo por 1.000 atendimentos (US$, escala log) — mais à esquerda é mais barato",
        format: moneyAuto,
      }),
      true,
    );
    chart(
      "02-efetividade",
      () =>
        rangeChart({
        title: "Efetividade: conversas aprovadas nas checagens determinísticas",
        subtitle: "Mesmas regras do npm run eval (intenção, tools esperadas/proibidas, transferência, privacidade). Faixa = IC 95% (bootstrap).",
        rows: [...withTurns]
          .sort((a, b) => b.passRate.mean - a.passRate.mean)
          .map((s) => ({ label: label(s), low: s.passRate.low, mid: s.passRate.mean, high: s.passRate.high, text: `${pct(s.passRate.mean)} (${s.conversations} conv.)`, highlight: s.key === winner })),
        domain: [0, 1],
        format: pct,
        legend: { mid: "taxa de aprovação", range: "intervalo de confiança 95%" },
      }),
    );
    const scenarioModels = withTurns;
    chart(
      "03-cenarios",
      () =>
        heatmap({
        title: "Onde cada modelo quebra: cenário × modelo",
        subtitle: "Aprovações / repetições. Os 4 cenários do PRD rodaram uma vez; os 10 do eval, duas.",
        columns: scenarioModels.map((s) => s.label),
        rows: allScenarios.map((scenario) => ({
          label: scenario.name.length > 40 ? `${scenario.name.slice(0, 38)}…` : scenario.name,
          cells: scenarioModels.map((s) => {
            const entry = s.scenarioPasses[scenario.name];
            return entry ? { value: entry.passed / entry.total, text: `${entry.passed}/${entry.total}` } : { value: null, text: "—" };
          }),
        })),
        domain: [0, 1],
        legend: ["0% aprovado", "100%"],
      }),
    );
    chart(
      "04-geval-criterios",
      () =>
        heatmap({
        title: "Qualidade G-Eval por critério (média do painel de juízes, 1–5)",
        subtitle: "Critérios derivados do PRD (decisão, regras, condução, clareza, transparência) + tom e português do Brasil.",
        columns: byComposite.map((s) => s.label),
        rows: CRITERIA.map((c) => ({
          label: c.name,
          cells: byComposite.map((s) => ({ value: s.quality.byCriterion[c.id], text: num(s.quality.byCriterion[c.id]) })),
        })),
        domain: [1, 5],
        legend: ["1 (ruim)", "5 (excelente)"],
      }),
      true,
    );
    const maxLatency = Math.max(...withTurns.map((s) => s.latency.p95).filter(Number.isFinite));
    chart(
      "05-latencia",
      () =>
        rangeChart({
        title: "Latência por turno (todos os passos do agent)",
        subtitle: "Ponto = mediana (p50); linha até o p95; verde = tempo até a 1ª palavra aparecer (p50).",
        rows: [...withTurns]
          .filter((s) => Number.isFinite(s.latency.p50))
          .sort((a, b) => a.latency.p50 - b.latency.p50)
          .map((s) => ({ label: label(s), low: s.latency.p50, mid: s.latency.p50, high: s.latency.p95, extra: s.latency.ttftP50, text: `${seconds(s.latency.p50)} · p95 ${seconds(s.latency.p95)}`, highlight: s.key === winner })),
        domain: [0, Math.ceil(maxLatency / 5000) * 5000],
        format: (v) => `${num(v / 1000, 0)} s`,
        legend: { mid: "p50", range: "até o p95", extra: "1ª palavra" },
      }),
    );
    chart(
      "06-custo-mensal",
      () =>
        groupedBarChart({
        title: "Custo mensal do modelo por tamanho de empresa",
        subtitle: `${num(BUSINESS.atendimentosPerEmployeeMonth, 1)} atendimento/funcionário/mês (MetricNet ≈ 0,38) × ${BUSINESS.turnsPerAtendimento} turnos × custo real por turno. Escala log.`,
        series: BUSINESS.employeeCounts.map((n) => `${n.toLocaleString("pt-BR")} funcionários`),
        rows: [...withTurns]
          .filter((s) => Number.isFinite(s.cost.perAtendimentoUsd))
          .sort((a, b) => a.cost.perAtendimentoUsd - b.cost.perAtendimentoUsd)
          .map((s) => {
            const rows = projectMonthlyCost(s.cost.perAtendimentoUsd);
            return { label: label(s), values: rows.map((r) => r.costPerMonthUsd), texts: rows.map((r) => moneyAuto(r.costPerMonthUsd)) };
          }),
        log: true,
        format: moneyAuto,
      }),
    );
    chart(
      "07-sensibilidade",
      () =>
        barChart({
        title: "Robustez: quem fica em 1º quando os pesos mudam",
        subtitle: "% de 10 mil vetores de pesos sorteados (efetividade, qualidade, latência, custo) em que cada modelo vence.",
        rows: Object.entries(sensitivity.winShare)
          .sort((a, b) => b[1] - a[1])
          .map(([key, share]) => ({ label: labelOf(key), value: share, text: pct(share), highlight: key === winner })),
        max: 1,
        format: pct,
        highlightLabel: "maior score com os pesos do relatório",
      }),
      true,
    );
    chart(
      "08-composto",
      () =>
        compositeChart({
        title: `Score composto (pesos ${Object.values(WEIGHTS).map((w) => w * 100).join("/")}: efetividade/qualidade/latência/custo)`,
        subtitle: "Cada segmento é a contribuição ponderada da dimensão; o total está no fim da barra.",
        rows: [
          ...ranked.map((s) => ({
            label: label(s),
            highlight: s.key === winner,
            parts: {
              effectiveness: WEIGHTS.effectiveness * s.scores.effectiveness,
              quality: WEIGHTS.quality * s.scores.quality,
              latency: WEIGHTS.latency * s.scores.latency,
              cost: WEIGHTS.cost * s.scores.cost,
            },
          })),
          ...summaries.filter((s) => !s.scores).map((s) => ({ label: s.label, parts: null, note: statusNote(s) })),
        ],
      }),
      true,
    );
    chart(
      "09-cache-acerto",
      () =>
        barChart({
        title: "Engenharia de cache: % do prompt lido do cache do provedor",
        subtitle: "Tokens de entrada cacheados ÷ tokens de entrada, em todas as chamadas do benchmark.",
        rows: [...withTurns].sort((a, b) => b.cache.hitRate - a.cache.hitRate).map((s) => ({ label: label(s), value: s.cache.hitRate, text: pct(s.cache.hitRate), highlight: s.key === winner })),
        max: 1,
        format: pct,
      }),
    );
    chart(
      "10-cache-custo",
      () =>
        groupedBarChart({
        title: "Custo por 1.000 atendimentos: com cache × sem cache",
        subtitle: "Sem cache = mesmos tokens pelo preço cheio do catálogo. Escala log.",
        series: ["com cache (pago)", "sem cache (contrafactual)"],
        rows: [...withTurns]
          .filter((s) => Number.isFinite(s.cost.perAtendimentoUsd))
          .sort((a, b) => a.cost.perAtendimentoUsd - b.cost.perAtendimentoUsd)
          .map((s) => ({
            label: label(s),
            values: [per1000(s), s.cache.noCachePerAtendimentoUsd * 1000],
            texts: [moneyAuto(per1000(s)), moneyAuto(s.cache.noCachePerAtendimentoUsd * 1000)],
          })),
        log: true,
        format: moneyAuto,
      }),
    );
    chart(
      "11-cache-cascata",
      () =>
        waterfall({
        title: "Quanto o cache economizou no benchmark inteiro",
        subtitle: "Do custo que teríamos sem cache até o que foi pago de fato (candidatos + juízes).",
        steps: [
          { label: "Sem cache (contrafactual)", value: agentsUsd + providerCacheSavedUsd + judgesUsd + responseCacheSavedUsd, kind: "total" },
          { label: "Cache do provedor", value: -providerCacheSavedUsd, kind: "delta" },
          { label: "Cache local de respostas", value: -responseCacheSavedUsd, kind: "delta" },
          { label: "Pago", value: agentsUsd + judgesUsd, kind: "total" },
        ],
        format: (v) => moneyAuto(Math.abs(v)),
      }),
    );
    chart(
      "12-cache-latencia",
      () =>
        rangeChart({
        title: "Latência por chamada ao modelo: sem cache × com cache",
        subtitle: "Mediana da duração de cada chamada. Verde = sem nada do cache; azul = parte do prompt veio do cache.",
        rows: withTurns
          .filter((s) => s.cache.warmCalls > 0 && s.cache.coldCalls > 0)
          .map((s) => ({
            label: label(s),
            low: Math.min(s.cache.warmCallMs, s.cache.coldCallMs),
            mid: s.cache.warmCallMs,
            high: Math.max(s.cache.warmCallMs, s.cache.coldCallMs),
            extra: s.cache.coldCallMs,
            text: `${seconds(s.cache.coldCallMs)} → ${seconds(s.cache.warmCallMs)}`,
          })),
        domain: [0, Math.ceil(Math.max(...withTurns.map((s) => Math.max(s.cache.coldCallMs || 0, s.cache.warmCallMs || 0))) / 1000) * 1000],
        format: (v) => `${num(v / 1000, 1)} s`,
        legend: { mid: "com cache", range: "diferença", extra: "sem cache" },
      }),
    );
  }

  function tablesMarkdown(): string {
    const md: string[] = [
      "# Benchmark de modelos — tabelas (gerado)",
      "",
      `> Gerado por \`npm run benchmark -- --report\` em ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC a partir de \`evals/benchmark/results/\`. Não edite à mão: a análise está em [RELATORIO.md](RELATORIO.md).`,
      "",
      `## Ranking — score composto (pesos ${Object.values(WEIGHTS).map((w) => w * 100).join("/")})`,
      "",
      table(
        ["#", "Modelo", "Composto", "Composto sem cache", "Efetividade", "Qualidade (1–5) [IC 95%]", "Latência p50", "Custo/atendimento", "Pareto"],
        ranked.map((s, i) => [
          String(i + 1),
          `**${s.label}**`,
          num(s.scores.composite, 3),
          `${num(s.scores.compositeNoCache, 3)} (${rankedNoCache.indexOf(s) + 1}º)`,
          pct(s.passRate.mean),
          `${num(s.quality.overall.mean)} [${num(s.quality.overall.low)}–${num(s.quality.overall.high)}]`,
          seconds(s.latency.p50),
          money(s.cost.perAtendimentoUsd),
          frontier.includes(s.key) ? "✓" : "",
        ]),
      ),
      "",
      ...summaries.filter((s) => !s.scores).map((s) => `- **${s.label}**: ${statusNote(s)}`),
      "",
      "## Efetividade — checagens determinísticas",
      "",
      table(
        ["Modelo", "Conversas ok [IC 95%]", "Conversas", "1º passo = recordUnderstanding", "Tool pedida e não executada", "Turnos com erro", "Retentativas por 429"],
        summaries.map((s) => [
          s.label,
          s.conversations ? `${pct(s.passRate.mean)} [${pct(s.passRate.low)}–${pct(s.passRate.high)}]` : "—",
          String(s.conversations),
          s.turns ? pct(s.forcedToolCompliance) : "—",
          s.turns ? pct(s.toolCallErrorRate) : "—",
          s.turns ? pct(s.turnErrorRate) : "—",
          String(s.rateLimitRetries),
        ]),
      ),
      "",
      "Aprovações por cenário (aprovadas / repetições):",
      "",
      table(
        ["Cenário", ...withTurns.map((s) => s.label)],
        allScenarios.map((scenario) => [
          scenario.name,
          ...withTurns.map((s) => {
            const entry = s.scenarioPasses[scenario.name];
            return entry ? `${entry.passed}/${entry.total}` : "—";
          }),
        ]),
      ),
      "",
      "## Qualidade — G-Eval, média do painel (1–5)",
      "",
      table(
        ["Modelo", ...CRITERIA.map((c) => c.name), "Geral", ...JUDGES.map((j) => `só ${j.label}`)],
        evaluated.map((s) => [
          s.label,
          ...CRITERIA.map((c) => num(s.quality.byCriterion[c.id])),
          `**${num(s.quality.overall.mean)}**`,
          ...JUDGES.map((j) => num(s.quality.byJudge[j.key] ?? NaN)),
        ]),
      ),
      "",
      "Rastreabilidade dos critérios:",
      "",
      table(
        ["Critério", "De onde vem no PRD", "Regras / specs do projeto"],
        CRITERIA.map((c) => [`**${c.name}** (\`${c.id}\`)`, c.prd, c.rules]),
      ),
      "",
      "## Latência e tokens por turno",
      "",
      table(
        ["Modelo", "p50", "p95", "1ª palavra (p50)", "Chamadas ao modelo", "Tokens de entrada", "Tokens de saída", "Tokens de raciocínio"],
        withTurns.map((s) => [
          s.label,
          seconds(s.latency.p50),
          seconds(s.latency.p95),
          seconds(s.latency.ttftP50),
          num(s.usage.callsPerTurn, 1),
          num(s.usage.inputTokensPerTurn, 0),
          num(s.usage.outputTokensPerTurn, 0),
          num(s.usage.reasoningTokensPerTurn, 0),
        ]),
      ),
      "",
      "## Custo real e projeção mensal",
      "",
      `Premissas: ${BUSINESS.turnsPerAtendimento} turnos por atendimento; ${num(BUSINESS.atendimentosPerEmployeeMonth, 1)} atendimento por funcionário por mês (cenário alto: ${num(BUSINESS.atendimentosPerEmployeeMonthHigh, 1)}).`,
      "",
      table(
        ["Modelo", "Gasto no benchmark", "Por turno", "Por atendimento", "Por 1.000 atendimentos", ...BUSINESS.employeeCounts.map((n) => `${n.toLocaleString("pt-BR")} func./mês`)],
        withTurns.map((s) => [
          s.label,
          money(s.cost.totalUsd, 3),
          money(s.cost.perTurnUsd),
          money(s.cost.perAtendimentoUsd),
          money(s.cost.per1000AtendimentosUsd, 2),
          ...projectMonthlyCost(s.cost.perAtendimentoUsd).map((row) => `${money(row.costPerMonthUsd, 2)} (alto ${money(row.costPerMonthHighUsd, 2)})`),
        ]),
      ),
      "",
      `Referência humana: ${money(BUSINESS.humanCostPerTicketUsd, 2)} por chamado no nível 1 (MetricNet/HDI) → ${projectMonthlyCost(0)
        .map((row) => `${row.employees.toLocaleString("pt-BR")} func.: ${money(row.humanEquivalentUsd, 0)}/mês`)
        .join(" · ")}.`,
      "",
      "## Engenharia de cache",
      "",
      table(
        ["Modelo", "Acerto de cache", "Economia do cache", "Custo pago", "Sem cache (contrafactual)", "Por 1.000 atend. com cache", "Sem cache", "Chamada sem cache (p50)", "Com cache (p50)"],
        withTurns.map((s) => [
          s.label,
          pct(s.cache.hitRate),
          money(s.cache.savedUsd),
          money(s.cost.totalUsd),
          money(s.cache.noCacheTotalUsd),
          money(s.cost.per1000AtendimentosUsd, 2),
          money(s.cache.noCachePerAtendimentoUsd * 1000, 2),
          `${seconds(s.cache.coldCallMs)} (${s.cache.coldCalls})`,
          `${seconds(s.cache.warmCallMs)} (${s.cache.warmCalls})`,
        ]),
      ),
      "",
      `Juízes: ${judgeCache.map((j) => `${JUDGES.find((x) => x.key === j.judge)?.label ?? j.judge} — ${pct(j.hitRate)} do prompt do cache, ${money(j.savedUsd)} economizados`).join(" · ")}. Cache local de respostas: ${money(responseCacheSavedUsd)} economizados em reexecuções.`,
      "",
      `Gasto total medido por chamada: candidatos ${money(agentsUsd, 3)} + juízes ${money(judgesUsd, 3)}; o cache do provedor evitou ${money(providerCacheSavedUsd, 3)}.`,
      "",
      "## Sensibilidade aos pesos",
      "",
      table(
        ["Perfil", "Pesos (efet./qual./lat./custo)", "1º", "2º", "3º"],
        Object.entries(sensitivity.profiles).map(([name, ranking]) => [
          name,
          Object.values(WEIGHT_PROFILES[name]).map((w) => Math.round(w * 100)).join("/"),
          ...[0, 1, 2].map((i) => (ranking[i] ? labelOf(ranking[i]) : "—")),
        ]),
      ),
      "",
      "Com 10 mil vetores de pesos sorteados (Dirichlet uniforme), quem fica em 1º:",
      "",
      table(
        ["Modelo", "Vezes em 1º"],
        Object.entries(sensitivity.winShare)
          .sort((a, b) => b[1] - a[1])
          .map(([key, share]) => [labelOf(key), pct(share)]),
      ),
      "",
      "## Juízes",
      "",
      "Calibração com três conversas de qualidade conhecida (média dos critérios):",
      "",
      table(
        ["Juiz", "Método", ...Object.keys(CALIBRATION_ANCHORS), "Ordem certa?"],
        JUDGES.filter((j) => calibration.judges[j.key]).map((j) => {
          const levels = Object.keys(CALIBRATION_ANCHORS) as AnchorLevel[];
          const means = Object.fromEntries(levels.map((level) => [level, mean(Object.values(calibration.judges[j.key][level]))])) as Record<AnchorLevel, number>;
          return [
            j.label,
            j.method === "logprobs" ? "logprobs (média ponderada)" : `amostragem (n=${j.samples})`,
            ...levels.map((l) => num(means[l])),
            calibrationPasses(means) ? "✓" : "✗",
          ];
        }),
      ),
      "",
      agreement
        ? `Concordância entre ${JUDGES[0].label} e ${JUDGES[1].label} nas ${agreement.n} conversas: Spearman ${num(agreement.spearman)}, diferença média absoluta ${num(agreement.meanAbsDiff)} ponto (médias ${num(agreement.meanA)} e ${num(agreement.meanB)}).`
        : "",
      "",
      "## Pré-voo — tool_choice forçado",
      "",
      table(
        ["Configuração", "Raciocínio", "Passou?", "Provedor", "Detalhe"],
        CANDIDATES.map((c) => {
          const gate = gates[c.key];
          return [c.label, c.effort, gate ? (gate.passed ? "✓" : "✗") : "—", gate?.provider ?? "—", gate?.error ?? (gate ? `chamou ${gate.toolCalled}` : "não testado")];
        }),
      ),
      "",
      "## Provedores que atenderam (chamadas)",
      "",
      table(
        ["Modelo", "Provedores"],
        withTurns.map((s) => [
          s.label,
          Object.entries(s.providers)
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => `${p} (${n})`)
            .join(", "),
        ]),
      ),
      "",
      "## Gasto por execução (medido pela chave do OpenRouter)",
      "",
      table(
        ["Início", "Gasto pela chave", "Somado por chamada", "Cache de respostas", "Crédito restante"],
        runs.map((r) => [
          String(r.startedAt).slice(0, 16).replace("T", " "),
          money(Number(r.spentByKeyUsd)),
          money(Number(r.trackedUsd)),
          money(Number(r.responseCacheSavedUsd ?? 0)),
          r.keyLimitRemainingUsd === null ? "—" : money(Number(r.keyLimitRemainingUsd)),
        ]),
      ),
      "",
    ];
    return md.join("\n");
  }
}

/** Acerto de cache do provedor nas chamadas de cada juiz. */
function judgeCacheStats(judgments: Judgment[], prices: Record<string, Pricing>) {
  const keys = [...new Set(judgments.map((j) => j.judge))];
  return keys.map((judge) => {
    const own = judgments.filter((j) => j.judge === judge);
    const input = own.reduce((sum, j) => sum + j.inputTokens, 0);
    const cached = own.reduce((sum, j) => sum + j.cachedTokens, 0);
    const price = prices[JUDGES.find((x) => x.key === judge)?.model ?? ""];
    return {
      judge,
      hitRate: input ? cached / input : 0,
      costUsd: own.reduce((sum, j) => sum + j.costUsd, 0),
      savedUsd: price ? cacheSavingsUsd({ cachedTokens: cached, cacheWriteTokens: 0 }, price) : 0,
    };
  });
}
