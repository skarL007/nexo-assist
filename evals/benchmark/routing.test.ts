import { describe, expect, it } from "vitest";
import type { Scenario } from "../scenarios";
import type { ConversationRecord, TurnRecord } from "./records";
import { DEFAULT_TRIGGER, scenarioNeedsWrite, shouldEscalate, simulateCascade, summarizeRouting, triggerConfusion } from "./routing";

const call = { status: 200, provider: "P", inputTokens: 1_000, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 50, reasoningTokens: 0, error: null };

function turn(intent: string | null, confidence = 0.95, overrides: Partial<TurnRecord> = {}): TurnRecord {
  return {
    text: "oi",
    reply: "Olá!",
    cards: [],
    decision: intent === null ? null : { intent, understanding: "", confidence, reasoning: "" },
    firstTool: "recordUnderstanding",
    toolCalls: [],
    guardrails: [],
    latencyMs: 4_000,
    ttftMs: 3_000,
    llmCalls: [
      { ...call, costUsd: 0.001, toolCalls: ["recordUnderstanding"], finishReason: "tool_calls", latencyMs: 1_000 },
      { ...call, costUsd: 0.002, toolCalls: [], finishReason: "stop", latencyMs: 2_000 },
    ],
    error: null,
    ...overrides,
  };
}

function conversation(candidate: string, scenario: string, turns: TurnRecord[], failures: string[] = [], rep = 1): ConversationRecord {
  return { candidate, model: `v/${candidate}`, effort: "minimal", scenario, rep, employeeName: "Ana", startedAt: "", turns, finalStatus: "with_agent", attempts: 1, discardedCostUsd: 0, failures };
}

const scenario = (name: string, expect: Scenario["expect"]): Scenario => ({ name, employee: "ana", turns: ["oi"], expect });

describe("gatilho do roteador", () => {
  it("dúvida com confiança alta fica no modelo barato", () => {
    expect(shouldEscalate({ intent: "question", confidence: 0.9 }, DEFAULT_TRIGGER)).toBe(false);
  });

  it("intenção que escreve chamado sobe para o modelo maior", () => {
    for (const intent of ["new_ticket", "ticket_update", "confirm_or_choose", "unclear"]) {
      expect(shouldEscalate({ intent, confidence: 0.99 }, DEFAULT_TRIGGER)).toBe(true);
    }
  });

  it("confiança baixa sobe mesmo numa intenção simples", () => {
    expect(shouldEscalate({ intent: "question", confidence: 0.3 }, DEFAULT_TRIGGER)).toBe(true);
  });

  it("sem passo 0 registrado, sobe (o barato não decidiu nada)", () => {
    expect(shouldEscalate(null, DEFAULT_TRIGGER)).toBe(true);
  });
});

describe("rótulo humano do cenário", () => {
  it("de risco quando o esperado inclui uma ferramenta que escreve chamado", () => {
    expect(scenarioNeedsWrite(scenario("abrir", { anyTool: ["draftNewTicket"] }))).toBe(true);
  });

  it("sem risco quando só lê, ou quando escrever é o que não pode acontecer", () => {
    expect(scenarioNeedsWrite(scenario("status", { anyTool: ["getTicket"] }))).toBe(false);
    expect(scenarioNeedsWrite(scenario("vaga", { noTool: ["draftNewTicket", "confirmDraft"] }))).toBe(false);
  });
});

describe("cascata", () => {
  const cheap = [
    conversation("barato", "dúvida", [turn("question")]),
    conversation("barato", "abrir", [turn("new_ticket")], ["esperava draftNewTicket"]),
  ];
  const strong = [
    conversation("forte", "dúvida", [turn("question")], ["errou"]),
    conversation("forte", "abrir", [turn("new_ticket", 0.95, { latencyMs: 6_000, llmCalls: [{ ...call, costUsd: 0.01, toolCalls: [], finishReason: "stop", latencyMs: 6_000 }] })]),
  ];

  it("usa o resultado do barato quando não sobe e o do forte quando sobe", () => {
    const routed = simulateCascade(cheap, strong, DEFAULT_TRIGGER);
    expect(routed.map((r) => [r.scenario, r.escalated, r.passed])).toEqual([
      ["dúvida", false, true],
      ["abrir", true, true],
    ]);
  });

  it("quando sobe, paga o passo 0 do barato mais a conversa do forte, e espera por ele", () => {
    const [kept, escalated] = simulateCascade(cheap, strong, DEFAULT_TRIGGER);
    expect(kept.costUsd).toBeCloseTo(0.003);
    expect(escalated.costUsd).toBeCloseTo(0.001 + 0.01);
    expect(escalated.turnLatenciesMs).toEqual([1_000 + 6_000]);
  });

  it("falha alto se o forte não tem a mesma conversa (cenário e repetição)", () => {
    expect(() => simulateCascade(cheap, strong.slice(0, 1), DEFAULT_TRIGGER)).toThrow(/abrir/);
  });

  it("resumo: acerto, quanto subiu e custo por 1.000 atendimentos (3 turnos cada)", () => {
    const summary = summarizeRouting(simulateCascade(cheap, strong, DEFAULT_TRIGGER));
    expect(summary.passRate.mean).toBe(1);
    expect(summary.escalationRate).toBe(0.5);
    expect(summary.per1000AtendimentosUsd).toBeCloseTo(((0.003 + 0.011) / 2) * 3 * 1000);
  });
});

describe("validação do gatilho contra o rótulo humano", () => {
  const labels = new Map([
    ["reabrir", true],
    ["dúvida", false],
    ["vaga", false],
  ]);
  const cheap = [
    // O risco só aparece no 2º turno: no 1º, parece uma dúvida comum.
    conversation("barato", "reabrir", [turn("question", 0.98), turn("ticket_update", 0.76)]),
    conversation("barato", "dúvida", [turn("question")]),
    conversation("barato", "vaga", [turn("ticket_update", 0.79)]),
  ];

  it("só pelo 1º turno, deixa passar o caso de risco que ainda parecia dúvida", () => {
    expect(triggerConfusion(cheap, labels, DEFAULT_TRIGGER, "first")).toMatchObject({ tp: 0, fn: 1, fp: 1, tn: 1, missed: ["reabrir"] });
  });

  it("turno a turno, pega o mesmo caso quando o risco aparece", () => {
    expect(triggerConfusion(cheap, labels, DEFAULT_TRIGGER, "any")).toMatchObject({ tp: 1, fn: 0, fp: 1, tn: 1, missed: [] });
  });
});
