import { describe, expect, it } from "vitest";
import type { TelemetrySink, TurnTelemetry } from "@/application/ports";
import { CompositeTelemetry, metricsAuthorized, PrometheusTelemetry } from "./prometheus";

const turn: TurnTelemetry = {
  conversationId: "conv-ana",
  employeeId: "emp-ana",
  startedAt: new Date("2026-11-02T12:00:00.000Z"),
  input: "minha VPN caiu",
  output: "Abri o rascunho.",
  trace: {
    traceId: "0af7651916cd43dd8448eb211c80319c",
    retrievals: [
      {
        query: "vpn caiu",
        mode: "hybrid",
        embeddingModel: "google/gemini-embedding-2",
        judgeModel: "google/gemini-3.5-flash-lite",
        verdict: "applies",
        candidates: [{ id: "kb-vpn-809", title: "VPN com erro 809", similarity: 0.71, terms: ["vpn"] }],
        chosen: ["kb-vpn-809"],
        latencyMs: 1400,
        degraded: ["embeddings x pausado pelo disjuntor"],
      },
    ],
    decision: { intent: "new_ticket", understanding: "VPN caiu", confidence: 0.9, reasoning: "" },
    steps: [{ label: "buscou na central de ajuda", ok: true }],
    toolCalls: [
      { tool: "searchHelpCenter", input: {}, output: {}, durationMs: 1450 },
      { tool: "draftNewTicket", input: {}, output: {}, durationMs: 40 },
    ],
    guardrails: ["regra"],
    model: "openrouter/openai/gpt-6-luna",
    fallbackFrom: null,
    usage: { inputTokens: 2100, outputTokens: 90 },
    latencyMs: 2500,
  },
};

describe("métricas Prometheus a partir do trace do turno", () => {
  it("o mesmo trace que o analista vê vira contadores e histogramas, sem texto nem pessoa", async () => {
    const prometheus = new PrometheusTelemetry();
    await prometheus.turnFinished(turn);
    const text = await prometheus.registry.metrics();

    expect(text).toContain('nexo_agent_turns_total{model="openrouter/openai/gpt-6-luna",intent="new_ticket",outcome="ok"} 1');
    expect(text).toContain('nexo_llm_tokens_total{model="openrouter/openai/gpt-6-luna",direction="input"} 2100');
    expect(text).toContain('nexo_llm_tokens_total{model="openrouter/openai/gpt-6-luna",direction="output"} 90');
    expect(text).toContain('nexo_tool_calls_total{tool="searchHelpCenter"} 1');
    expect(text).toContain('nexo_tool_duration_seconds_bucket{le="2.5",tool="searchHelpCenter"} 1');
    expect(text).toContain('nexo_agent_turn_duration_seconds_sum{model="openrouter/openai/gpt-6-luna"} 2.5');
    expect(text).toContain('nexo_guardrails_total 1');
    expect(text).toContain('nexo_retrieval_total{mode="hybrid",verdict="applies"} 1');
    expect(text).toContain('nexo_retrieval_degraded_total{component="embeddings"} 1');
    expect(text).toContain("nexo_retrieval_top_similarity_sum 0.71");
    for (const secret of ["VPN caiu", "vpn caiu", "emp-ana", "conv-ana", "kb-vpn-809"]) expect(text).not.toContain(secret);
  });

  it("turno com passo que falhou conta como erro; com modelo reserva, como fallback", async () => {
    const prometheus = new PrometheusTelemetry();
    await prometheus.turnFinished({ ...turn, trace: { ...turn.trace, steps: [{ label: "x", ok: false }] } });
    await prometheus.turnFinished({ ...turn, trace: { ...turn.trace, fallbackFrom: "google/gemini-3.5-flash" } });
    const text = await prometheus.registry.metrics();
    expect(text).toContain('outcome="error"} 1');
    expect(text).toContain('outcome="fallback"} 1');
  });

  it("uma instância não vaza para outra (cada uma tem o próprio registro)", async () => {
    const a = new PrometheusTelemetry();
    await a.turnFinished(turn);
    expect(await new PrometheusTelemetry().registry.metrics()).not.toContain("nexo_agent_turns_total{");
  });
});

describe("vários destinos de telemetria", () => {
  it("um destino que falha não impede os outros", async () => {
    const seen: string[] = [];
    const broken: TelemetrySink = { turnFinished: async () => Promise.reject(new Error("coletor fora")) };
    const ok: TelemetrySink = { turnFinished: async (t) => void seen.push(t.conversationId) };
    await expect(new CompositeTelemetry([broken, ok]).turnFinished(turn)).resolves.toBeUndefined();
    expect(seen).toEqual(["conv-ana"]);
  });
});

describe("acesso ao /api/metrics", () => {
  it("sem METRICS_TOKEN configurado, ninguém lê; com ele, só o Bearer exato", () => {
    expect(metricsAuthorized("Bearer qualquer", undefined)).toBe("disabled");
    expect(metricsAuthorized(null, "s3cr3t-s3cr3t-s3cr3t")).toBe("denied");
    expect(metricsAuthorized("Bearer errado", "s3cr3t-s3cr3t-s3cr3t")).toBe("denied");
    expect(metricsAuthorized("Bearer s3cr3t-s3cr3t-s3cr3t", "s3cr3t-s3cr3t-s3cr3t")).toBe("ok");
  });
});

describe("alertas e painel do Grafana (observability/)", () => {
  it("toda série nexo_* citada existe no registro, com o sufixo certo para o tipo", async () => {
    const { readFileSync } = await import("node:fs");
    const sources = ["observability/prometheus/alerts.yml", "observability/grafana/dashboards/nexo-assist.json"].map((f) => readFileSync(f, "utf8")).join("\n");
    const cited = new Set(sources.match(/nexo_[a-z_]+/g));
    const registry = new PrometheusTelemetry({ processMetrics: true }).registry;
    const metrics = await registry.getMetricsAsJSON();
    const valid = new Set(
      metrics.flatMap((m) => (String(m.type) === "histogram" ? [`${m.name}_bucket`, `${m.name}_sum`, `${m.name}_count`] : [m.name])),
    );
    expect([...cited].filter((name) => !valid.has(name))).toEqual([]);
    expect(cited.size).toBeGreaterThan(8);
  });
});
