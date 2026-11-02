import { describe, expect, it } from "vitest";
import type { TurnTrace } from "@/domain/message";
import { evaluateGates, summarizeTelemetry, type PersonaRun } from "./telemetry";

const trace = (over: Partial<TurnTrace> = {}): TurnTrace => ({
  decision: { intent: "new_ticket", understanding: "", confidence: 0.8, reasoning: "" },
  steps: [{ label: "x", ok: true }],
  toolCalls: [{ tool: "searchHelpCenter", input: {}, output: {}, durationMs: 1000 }],
  guardrails: [],
  model: "openrouter/openai/gpt-6-luna",
  usage: { inputTokens: 1000, outputTokens: 100 },
  latencyMs: 4000,
  retrievals: [
    { query: "q", mode: "hybrid", embeddingModel: "e", judgeModel: "j", verdict: "applies", candidates: [], chosen: ["kb"], latencyMs: 1200, degraded: [] },
  ],
  ...over,
});

describe("telemetria agregada das conversas simuladas", () => {
  it("soma turnos, tokens, buscas por veredito, degradação, regras, reserva e latência p50/p95", () => {
    const traces = [
      trace(),
      trace({ latencyMs: 9000, guardrails: ["r"], fallbackFrom: "google/gemini-3.5-flash", retrievals: [{ query: "q", mode: "keyword", embeddingModel: null, judgeModel: null, verdict: null, candidates: [], chosen: [], latencyMs: 300, degraded: ["embeddings x fora do ar (402)"] }] }),
      trace({ steps: [{ label: "y", ok: false }], retrievals: undefined, toolCalls: [{ tool: "getTicket", input: {}, output: {}, durationMs: 200 }] }),
    ];
    const summary = summarizeTelemetry(traces);
    expect(summary).toMatchObject({
      turns: 3,
      tokens: { input: 3000, output: 300 },
      retrievals: 2,
      verdicts: { applies: 1, sem_avaliador: 1 },
      degradedRetrievals: 1,
      guardrails: 1,
      fallbackTurns: 1,
      failedSteps: 1,
      turnLatency: { p50: 4000, p95: 9000 },
    });
    expect(summary.toolP95.searchHelpCenter).toBe(1000);
    expect(summary.meanConfidence).toBeCloseTo(0.8, 5);
  });

  it("sem traces, zeros (conversa que só recebeu respostas do sistema)", () => {
    expect(summarizeTelemetry([])).toMatchObject({ turns: 0, retrievals: 0, turnLatency: { p50: 0, p95: 0 } });
  });
});

describe("portões de 95% do benchmark de personas", () => {
  const run = (persona: string, style: string, pass: boolean, geval?: Record<string, number>): PersonaRun => ({ persona, style, pass, geval: geval ?? null });

  it("aprova só se a taxa de sucesso ≥ 95% e a G-Eval média ≥ 4,5 em todos os critérios; mostra o IC de Wilson", () => {
    const runs = Array.from({ length: 40 }, (_, i) => run(`p${i % 10}`, i % 2 ? "formal" : "coloquial", true, { decisao: 4.8, tom: 4.6 }));
    const gates = evaluateGates(runs);
    expect(gates.passRate).toMatchObject({ k: 40, n: 40, ok: true });
    expect(gates.passRate.low).toBeGreaterThan(0.9);
    expect(gates.passRate.low).toBeLessThan(0.95);
    expect(gates.geval.every((g) => g.ok)).toBe(true);
    expect(gates.approved).toBe(true);
  });

  it("um estilo abaixo de 95% reprova, mesmo com a média geral alta", () => {
    const runs = [
      ...Array.from({ length: 30 }, () => run("a", "formal", true)),
      ...Array.from({ length: 4 }, (_, i) => run("b", "digitacao", i < 2)),
    ];
    const gates = evaluateGates(runs);
    expect(gates.byStyle.find((s) => s.style === "digitacao")).toMatchObject({ k: 2, n: 4, ok: false });
    expect(gates.approved).toBe(false);
  });

  it("critério da G-Eval abaixo de 4,5 reprova; sem nenhuma nota, o portão fica 'não medido' e não aprova", () => {
    expect(evaluateGates([run("a", "x", true, { decisao: 4.9, tom: 4.1 })]).geval.find((g) => g.criterion === "tom")?.ok).toBe(false);
    const unmeasured = evaluateGates([run("a", "x", true)]);
    expect(unmeasured.geval).toEqual([]);
    expect(unmeasured.approved).toBe(false);
  });
});
