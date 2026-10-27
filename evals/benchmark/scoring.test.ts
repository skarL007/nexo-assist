import { describe, expect, it } from "vitest";
import { WEIGHTS, type Candidate } from "./config";
import type { GateResult } from "./gate";
import type { ConversationRecord, Judgment, TurnRecord } from "./records";
import { compositeScore, costScore, latencyScore, paretoFrontier, projectMonthlyCost, summarizeCandidate, weightSensitivity } from "./scoring";

const candidate: Candidate = { key: "x", model: "v/x", label: "X", tier: "econômico", effort: "minimal", why: "" };

function turn(overrides: Partial<TurnRecord> = {}): TurnRecord {
  return {
    text: "oi",
    reply: "Olá!",
    cards: [],
    decision: { intent: "greeting", confidence: 0.9 },
    firstTool: "recordUnderstanding",
    toolCalls: [{ tool: "recordUnderstanding", input: "{}", output: "{}" }],
    guardrails: [],
    latencyMs: 4_000,
    ttftMs: 3_000,
    llmCalls: [
      { status: 200, provider: "P", costUsd: 0.001, inputTokens: 1_000, outputTokens: 50, reasoningTokens: 0, toolCalls: ["recordUnderstanding"], finishReason: "tool_calls", error: null, latencyMs: 900 },
      { status: 200, provider: "P", costUsd: 0.001, inputTokens: 1_100, outputTokens: 40, reasoningTokens: 0, toolCalls: [], finishReason: "stop", error: null, latencyMs: 900 },
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
  scores: { resolucao: score, conducao: score, clareza: score, aderencia: score, tom: score, idioma: score },
  methods: {},
  costUsd: 0,
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

  it("reprovado no pré-voo fica desqualificado, sem score", () => {
    const summary = summarizeCandidate(candidate, [], [], { ...passing, passed: false, error: "Provider returned error" }, WEIGHTS);
    expect(summary.status).toBe("desqualificado");
    expect(summary.disqualifiedReason).toContain("Provider returned error");
    expect(summary.scores).toBeNull();
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
