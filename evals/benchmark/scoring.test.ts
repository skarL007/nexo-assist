import { describe, expect, it } from "vitest";
import { WEIGHTS, type Candidate } from "./config";
import type { GateResult } from "./gate";
import { CRITERIA } from "./geval";
import type { ConversationRecord, Judgment, TurnRecord } from "./records";
import {
  cacheSavingsUsd,
  compositeScore,
  costScore,
  latencyScore,
  paretoFrontier,
  projectMonthlyCost,
  summarizeCandidate,
  weightSensitivity,
} from "./scoring";

const candidate: Candidate = { key: "x", model: "v/x", label: "X", tier: "econômico", effort: "minimal", why: "" };

const call = { status: 200, provider: "P", cacheWriteTokens: 0, outputTokens: 50, reasoningTokens: 0, error: null };

function turn(overrides: Partial<TurnRecord> = {}): TurnRecord {
  return {
    text: "oi",
    reply: "Olá!",
    cards: [],
    decision: { intent: "greeting", understanding: "Cumprimento", confidence: 0.9, reasoning: "Só responder" },
    firstTool: "recordUnderstanding",
    toolCalls: [{ tool: "recordUnderstanding", input: "{}", output: "{}" }],
    guardrails: [],
    latencyMs: 4_000,
    ttftMs: 3_000,
    llmCalls: [
      { ...call, costUsd: 0.001, inputTokens: 1_000, cachedTokens: 0, toolCalls: ["recordUnderstanding"], finishReason: "tool_calls", latencyMs: 1_200 },
      { ...call, costUsd: 0.001, inputTokens: 1_100, cachedTokens: 1_000, toolCalls: [], finishReason: "stop", latencyMs: 800 },
    ],
    error: null,
    ...overrides,
  };
}

function conversation(scenario: string, rep: number, failures: string[] = [], turns = [turn()]): ConversationRecord {
  return { candidate: "x", model: "v/x", effort: "minimal", scenario, rep, employeeName: "Ana", startedAt: "", turns, finalStatus: "with_agent", attempts: 1, discardedCostUsd: 0, failures };
}

const judgment = (scenario: string, rep: number, judge: string, score: number): Judgment => ({
  judge,
  candidate: "x",
  scenario,
  rep,
  scores: Object.fromEntries(CRITERIA.map((c) => [c.id, score])),
  methods: {},
  costUsd: 0,
  savedUsd: 0,
  inputTokens: 0,
  cachedTokens: 0,
  error: null,
});

describe("notas por dimensão", () => {
  it("latência: âncoras de 2 s (1) e 12 s (0), linear no meio", () => {
    expect(latencyScore(2_000)).toBe(1);
    expect(latencyScore(7_000)).toBeCloseTo(0.5);
    expect(latencyScore(20_000)).toBe(0);
  });

  it("custo: escala log entre US$ 0,001 e US$ 0,10 por atendimento", () => {
    expect(costScore(0.001)).toBe(1);
    expect(costScore(0.01)).toBeCloseTo(0.5);
    expect(costScore(0.5)).toBe(0);
  });

  it("composto respeita os pesos", () => {
    expect(compositeScore({ effectiveness: 1, quality: 0, latency: 0, cost: 0 }, WEIGHTS)).toBeCloseTo(0.4);
  });
});

describe("resumo de um candidato", () => {
  const passing: GateResult = { candidate: "x", model: "v/x", effort: "minimal", passed: true, toolCalled: "recordUnderstanding", provider: "P", error: null, costUsd: 0, checkedAt: "" };

  it("junta efetividade, conformidade, custo e qualidade do painel", () => {
    const summary = summarizeCandidate(
      candidate,
      [conversation("a", 1), conversation("b", 1, ["intenção errada"])],
      [judgment("a", 1, "j1", 5), judgment("a", 1, "j2", 4), judgment("b", 1, "j1", 3), judgment("b", 1, "j2", 3)],
      passing,
      WEIGHTS,
    );
    expect(summary.status).toBe("avaliado");
    expect(summary.passRate.mean).toBe(0.5);
    expect(summary.forcedToolCompliance).toBe(1);
    expect(summary.toolCallErrorRate).toBe(0);
    expect(summary.cost.perTurnUsd).toBeCloseTo(0.002);
    expect(summary.quality.overall.mean).toBeCloseTo((4.5 + 3) / 2);
    expect(summary.usage.callsPerTurn).toBe(2);
    expect(summary.scores?.composite).toBeGreaterThan(0);
  });

  it("tool pedida que não executou conta como erro de tool", () => {
    const broken = turn({ toolCalls: [], firstTool: null });
    const summary = summarizeCandidate(candidate, [conversation("a", 1, [], [broken])], [], passing, WEIGHTS);
    expect(summary.toolCallErrorRate).toBe(1);
    expect(summary.forcedToolCompliance).toBe(0);
    expect(summary.status).toBe("desqualificado");
  });

  it("provedor que cai depois do passo 0 não conta como desobediência nem como tool inválida", () => {
    const aborted = turn({
      toolCalls: [],
      firstTool: null,
      error: "The operation was aborted",
      llmCalls: [
        { ...call, costUsd: 0.001, inputTokens: 1_000, cachedTokens: 0, toolCalls: ["recordUnderstanding"], finishReason: "tool_calls", latencyMs: 1_200 },
        { ...call, costUsd: 0, inputTokens: 0, cachedTokens: 0, toolCalls: [], finishReason: null, latencyMs: 13_000, error: "The operation was aborted" },
      ],
    });
    const summary = summarizeCandidate(candidate, [conversation("a", 1, ["erro técnico em turno"], [aborted]), conversation("b", 1)], [], passing, WEIGHTS);
    expect(summary.forcedToolCompliance).toBe(1);
    expect(summary.toolCallErrorRate).toBe(0);
    expect(summary.turnErrorRate).toBe(0.5);
    expect(summary.status).toBe("avaliado");
  });

  it("reprovado no pré-voo fica desqualificado, sem score", () => {
    const summary = summarizeCandidate(candidate, [], [], { ...passing, passed: false, error: "Provider returned error" }, WEIGHTS);
    expect(summary.status).toBe("desqualificado");
    expect(summary.disqualifiedReason).toContain("Provider returned error");
    expect(summary.scores).toBeNull();
  });
});

describe("engenharia de cache", () => {
  // GPT-6 Luna: entrada US$ 0,10/1M, leitura do cache US$ 0,01/1M, escrita US$ 0,125/1M.
  const luna = { prompt: 0.1e-6, completion: 0.5e-6, input_cache_read: 0.01e-6, input_cache_write: 0.125e-6 };

  it("leitura do cache economiza a diferença de preço; escrita cara desconta", () => {
    expect(cacheSavingsUsd({ cachedTokens: 1_000_000, cacheWriteTokens: 0 }, luna)).toBeCloseTo(0.09);
    expect(cacheSavingsUsd({ cachedTokens: 0, cacheWriteTokens: 1_000_000 }, luna)).toBeCloseTo(-0.025);
  });

  it("sem preço de cache no catálogo, não há economia a contar", () => {
    expect(cacheSavingsUsd({ cachedTokens: 5_000, cacheWriteTokens: 0 }, { prompt: 1e-6, completion: 2e-6 })).toBe(0);
  });

  it("resumo traz acerto de cache, custo contrafactual e latência fria × quente", () => {
    const summary = summarizeCandidate(candidate, [conversation("a", 1)], [judgment("a", 1, "j1", 4)], undefined, WEIGHTS, luna);
    expect(summary.cache.hitRate).toBeCloseTo(1_000 / 2_100);
    expect(summary.cache.savedUsd).toBeCloseTo(1_000 * 0.09e-6);
    expect(summary.cache.noCacheTotalUsd).toBeCloseTo(summary.cost.totalUsd + summary.cache.savedUsd);
    expect(summary.cache.coldCallMs).toBe(1_200);
    expect(summary.cache.warmCallMs).toBe(800);
    expect(summary.scores!.compositeNoCache).toBeLessThanOrEqual(summary.scores!.composite);
  });
});

describe("decisão", () => {
  it("Pareto: fica quem ninguém supera em custo e qualidade ao mesmo tempo", () => {
    const frontier = paretoFrontier([
      { key: "barato", cost: 0.001, quality: 3.5 },
      { key: "caro-bom", cost: 0.05, quality: 4.6 },
      { key: "caro-ruim", cost: 0.06, quality: 3.0 },
      { key: "meio", cost: 0.01, quality: 4.2 },
    ]);
    expect(frontier.sort()).toEqual(["barato", "caro-bom", "meio"]);
  });

  it("sensibilidade: quem domina em tudo ganha com qualquer peso", () => {
    const result = weightSensitivity(
      [
        { key: "a", scores: { effectiveness: 0.9, quality: 0.9, latency: 0.9, cost: 0.9 } },
        { key: "b", scores: { effectiveness: 0.5, quality: 0.5, latency: 0.5, cost: 0.5 } },
      ],
      { Equilibrado: WEIGHTS },
      500,
    );
    expect(result.winShare.a).toBe(1);
    expect(result.profiles.Equilibrado).toEqual(["a", "b"]);
  });

  it("projeção mensal: funcionários × atendimentos × custo por atendimento", () => {
    const [first] = projectMonthlyCost(0.05);
    expect(first.employees).toBe(500);
    expect(first.atendimentosPerMonth).toBe(200);
    expect(first.costPerMonthUsd).toBeCloseTo(10);
  });
});
