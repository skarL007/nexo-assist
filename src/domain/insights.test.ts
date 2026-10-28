import { describe, expect, it } from "vitest";
import { computeInsights, type InsightsInput } from "./insights";
import type { Card, TurnTrace } from "./message";

const trace = (latencyMs: number, confidence: number, tokens = { inputTokens: 2000, outputTokens: 100 }): TurnTrace => ({
  decision: { intent: "question", understanding: "", confidence, reasoning: "" },
  steps: [],
  toolCalls: [],
  guardrails: [],
  model: "google/gemini-3.5-flash",
  usage: tokens,
  latencyMs,
});
const handoffCard = (reason: "critical" | "low_confidence" | "employee_request" | "overdue"): Card => ({ kind: "handoff", reason, summary: "…" });
const at = "2026-10-27T13:00:00.000Z";

const input: InsightsInput = {
  messages: [
    // c1: resolvida pelo agent
    { conversationId: "c1", role: "employee", cards: [], trace: null, createdAt: at },
    { conversationId: "c1", role: "agent", cards: [], trace: trace(1000, 0.9), createdAt: at },
    // c2: transferida (caso crítico) e respondida por analista
    { conversationId: "c2", role: "employee", cards: [], trace: null, createdAt: at },
    { conversationId: "c2", role: "agent", cards: [], trace: trace(3000, 0.8), createdAt: at },
    { conversationId: "c2", role: "system", cards: [handoffCard("critical")], trace: null, createdAt: at },
    { conversationId: "c2", role: "analyst", cards: [], trace: null, createdAt: at },
    // c3: transferida por baixa confiança
    { conversationId: "c3", role: "employee", cards: [], trace: null, createdAt: at },
    { conversationId: "c3", role: "agent", cards: [], trace: trace(2000, 0.3), createdAt: at },
    { conversationId: "c3", role: "system", cards: [handoffCard("low_confidence")], trace: null, createdAt: at },
    // c4: resolvida pelo agent
    { conversationId: "c4", role: "employee", cards: [], trace: null, createdAt: at },
    { conversationId: "c4", role: "agent", cards: [], trace: trace(10_000, 0.7), createdAt: at },
    // resposta do sistema sem o modelo (botão Confirmar, Alterar detalhes): não entra em tempo nem custo
    { conversationId: "c4", role: "agent", cards: [], trace: { ...trace(5, 1), decision: null, model: null, usage: null }, createdAt: at },
    // c5: só mensagem do sistema, sem funcionário (não conta)
    { conversationId: "c5", role: "system", cards: [], trace: null, createdAt: at },
  ],
  feedback: [{ helpful: true }, { helpful: true }, { helpful: false }],
  drafts: [{ status: "confirmed" }, { status: "confirmed" }, { status: "cancelled" }, { status: "replaced" }, { status: "pending" }],
  analysts: 2,
  price: { input: 1.5e-6, output: 9e-6 },
};

describe("indicadores do atendimento", () => {
  const insights = computeInsights(input);

  it("conta só conversas com mensagem do funcionário e quantas o agent resolveu sem analista", () => {
    expect(insights.conversations).toBe(4);
    expect(insights.resolvedWithoutHuman).toBe(0.5);
  });

  it("transferências por motivo, sempre na mesma ordem (motivos sem caso aparecem com zero)", () => {
    expect(insights.handoffs).toEqual([
      { reason: "employee_request", count: 0 },
      { reason: "critical", count: 1 },
      { reason: "overdue", count: 0 },
      { reason: "low_confidence", count: 1 },
    ]);
  });

  it("tempo de resposta do agent: média e p95; confiança média e taxa de baixa confiança", () => {
    expect(insights.agentTurns).toBe(4);
    expect(insights.avgLatencyMs).toBe(4000);
    expect(insights.p95LatencyMs).toBe(10_000);
    expect(insights.avgConfidence).toBeCloseTo(0.675);
    expect(insights.lowConfidenceRate).toBe(0.25);
  });

  it("custo estimado pelos tokens gravados no trace", () => {
    expect(insights.tokens).toEqual({ input: 8000, output: 400 });
    // 8000 × 1,5e-6 + 400 × 9e-6 = 0,0156
    expect(insights.costUsd).toBeCloseTo(0.0156, 6);
    expect(insights.costPerConversationUsd).toBeCloseTo(0.0039, 6);
  });

  it("feedback \"Isso resolveu?\" e rascunhos confirmados (substituídos não contam)", () => {
    expect(insights.feedback).toEqual({ helpful: 2, notHelpful: 1, rate: 2 / 3 });
    expect(insights.drafts).toEqual({ confirmed: 2, cancelled: 1, pending: 1, confirmRate: 2 / 3 });
    expect(insights.analysts).toBe(2);
  });

  it("sem dados, as taxas ficam null (a tela mostra \"—\" em vez de 0% ou NaN)", () => {
    const empty = computeInsights({ messages: [], feedback: [], drafts: [], analysts: 2, price: null });
    expect(empty).toMatchObject({
      conversations: 0,
      resolvedWithoutHuman: null,
      avgLatencyMs: null,
      p95LatencyMs: null,
      avgConfidence: null,
      costUsd: null,
      feedback: { rate: null },
      drafts: { confirmRate: null },
    });
  });
});
