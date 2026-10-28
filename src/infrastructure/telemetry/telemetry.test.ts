import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { TurnTelemetry } from "@/application/ports";
import { OtlpTraceExporter, telemetryConfig } from "./otlp-exporter";
import { pseudonym, turnToOtlp, type OtlpPayload } from "./otlp-mapping";

const turn: TurnTelemetry = {
  conversationId: "conv-ana",
  employeeId: "emp-ana",
  startedAt: new Date("2026-10-28T12:00:00.000Z"),
  input: "minha VPN caiu, sou a Ana do financeiro",
  output: "Abri o rascunho do chamado da VPN.",
  trace: {
    decision: { intent: "new_ticket", understanding: "VPN caiu", confidence: 0.9, reasoning: "" },
    steps: [{ label: "procurou na central", ok: true }],
    toolCalls: [
      { tool: "searchHelpCenter", input: { query: "vpn" }, output: { articles: 1 }, durationMs: 120 },
      { tool: "draftTicket", input: { title: "VPN caiu" }, output: { draftId: 7 }, durationMs: 40 },
    ],
    guardrails: [],
    model: "google/gemini-3.5-flash",
    usage: { inputTokens: 2100, outputTokens: 90 },
    latencyMs: 2500,
  },
};

let counter = 0;
const randomHex = (bytes: number) => (++counter).toString(16).padStart(bytes * 2, "0");
const attrs = (span: OtlpPayload["resourceSpans"][0]["scopeSpans"][0]["spans"][0]) =>
  Object.fromEntries(span.attributes.map((a) => [a.key, Object.values(a.value)[0]]));

describe("turno → spans OTLP (convenções GenAI)", () => {
  it("raiz invoke_agent com modelo, tokens e sessão; uma span por tool, filhas da raiz", () => {
    const payload = turnToOtlp(turn, { captureContent: false, randomHex });
    const [root, search, draft] = payload.resourceSpans[0].scopeSpans[0].spans;
    expect(attrs(root)).toMatchObject({
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.provider.name": "google",
      "gen_ai.request.model": "gemini-3.5-flash",
      "gen_ai.usage.input_tokens": "2100",
      "gen_ai.usage.output_tokens": "90",
      "langfuse.session.id": "conv-ana",
      "nexo.intent": "new_ticket",
    });
    expect(root.endTimeUnixNano).toBe(`${BigInt(Date.parse("2026-10-28T12:00:02.500Z")) * BigInt(1_000_000)}`);
    expect([search.name, draft.name]).toEqual(["execute_tool searchHelpCenter", "execute_tool draftTicket"]);
    expect(search.parentSpanId).toBe(root.spanId);
    expect(draft.traceId).toBe(root.traceId);
    expect(draft.startTimeUnixNano).toBe(search.endTimeUnixNano);
  });

  it("sem captura de conteúdo, nada do que a pessoa escreveu sai, nem quem ela é", () => {
    const body = JSON.stringify(turnToOtlp(turn, { captureContent: false, randomHex }));
    for (const secret of ["VPN caiu", "Ana", "financeiro", "emp-ana", "rascunho", "vpn"]) expect(body).not.toContain(secret);
    expect(body).toContain(pseudonym("emp-ana"));
  });

  it("com captura ligada, entrada, saída e argumentos das tools vão junto", () => {
    const [root, search] = turnToOtlp(turn, { captureContent: true, randomHex }).resourceSpans[0].scopeSpans[0].spans;
    expect(attrs(root)["langfuse.observation.input"]).toBe(turn.input);
    expect(attrs(root)["langfuse.observation.output"]).toBe(turn.output);
    expect(attrs(search)["gen_ai.tool.call.arguments"]).toBe('{"query":"vpn"}');
  });
});

describe("configuração da telemetria", () => {
  it("desligada sem nenhuma variável", () => {
    expect(telemetryConfig({})).toBeNull();
  });

  it("Langfuse: endpoint OTLP dele, Basic com as chaves e a versão de ingestão", () => {
    const config = telemetryConfig({ LANGFUSE_PUBLIC_KEY: "pk-lf-1", LANGFUSE_SECRET_KEY: "sk-lf-2", LANGFUSE_BASE_URL: "https://us.cloud.langfuse.com/" });
    expect(config).toEqual({
      endpoint: "https://us.cloud.langfuse.com/api/public/otel/v1/traces",
      headers: { Authorization: `Basic ${Buffer.from("pk-lf-1:sk-lf-2").toString("base64")}`, "x-langfuse-ingestion-version": "4" },
      captureContent: false,
    });
  });

  it("OTLP genérico com as variáveis padrão do OpenTelemetry", () => {
    expect(
      telemetryConfig({
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://collector:4318/v1/traces",
        OTEL_EXPORTER_OTLP_TRACES_HEADERS: "x-api-key=abc,x-team=n%20x",
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: true,
      }),
    ).toEqual({ endpoint: "http://collector:4318/v1/traces", headers: { "x-api-key": "abc", "x-team": "n x" }, captureContent: true });
  });
});

describe("exportador contra um coletor OTLP local de verdade", () => {
  let server: Server | undefined;
  afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

  async function collector(handler: (body: string, headers: Record<string, unknown>) => number, delayMs = 0) {
    const received: { body: OtlpPayload; headers: Record<string, unknown> }[] = [];
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received.push({ body: JSON.parse(body) as OtlpPayload, headers: req.headers });
        setTimeout(() => res.writeHead(handler(body, req.headers)).end(), delayMs);
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1/traces`, received };
  }

  it("envia o payload em JSON com os cabeçalhos configurados", async () => {
    const { url, received } = await collector(() => 200);
    const logs: string[] = [];
    await new OtlpTraceExporter({ endpoint: url, headers: { Authorization: "Basic x" }, captureContent: false }, fetch, 2000, (m) => logs.push(m)).turnFinished(turn);
    expect(received).toHaveLength(1);
    expect(received[0].headers["content-type"]).toBe("application/json");
    expect(received[0].headers.authorization).toBe("Basic x");
    expect(received[0].body.resourceSpans[0].scopeSpans[0].spans).toHaveLength(3);
    expect(logs).toEqual([]);
  });

  it("coletor com erro ou lento não derruba o turno: só registra", async () => {
    const failing = await collector(() => 401);
    const logs: string[] = [];
    await new OtlpTraceExporter({ endpoint: failing.url, headers: {}, captureContent: false }, fetch, 2000, (m) => logs.push(m)).turnFinished(turn);
    expect(logs).toEqual(["[telemetria] o coletor respondeu 401"]);

    await new Promise<void>((resolve) => server!.close(() => resolve()));
    const slow = await collector(() => 200, 500);
    const started = Date.now();
    await new OtlpTraceExporter({ endpoint: slow.url, headers: {}, captureContent: false }, fetch, 100, (m) => logs.push(m)).turnFinished(turn);
    expect(Date.now() - started).toBeLessThan(450);
    expect(logs[1]).toMatch(/^\[telemetria\] envio falhou/);
  });
});
