/**
 * Coletor OTLP/HTTP mínimo, para ver localmente o que a telemetria manda (sem conta em lugar nenhum).
 *
 *   npm run otel:local                     → escuta em http://127.0.0.1:4318/v1/traces
 *   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces npm run dev   (ou npm run eval)
 *
 * Mostra cada span (nome, modelo, tokens, duração) e grava tudo em otel-local.jsonl.
 */
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4318);
const FILE = "otel-local.jsonl";

interface Span {
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  parentSpanId?: string;
  attributes: { key: string; value: Record<string, unknown> }[];
}

createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/traces") return void res.writeHead(404).end();
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const payload = JSON.parse(body) as { resourceSpans: { scopeSpans: { spans: Span[] }[] }[] };
      appendFileSync(FILE, `${body}\n`);
      for (const span of payload.resourceSpans.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans))) {
        const attrs = Object.fromEntries(span.attributes.map((a) => [a.key, Object.values(a.value)[0]]));
        const ms = Number((BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) / BigInt(1_000_000));
        const detail = span.parentSpanId
          ? `${ms} ms`
          : `${attrs["gen_ai.request.model"] ?? "?"} · ${attrs["gen_ai.usage.input_tokens"] ?? 0}+${attrs["gen_ai.usage.output_tokens"] ?? 0} tokens · ${ms} ms · intenção ${attrs["nexo.intent"] ?? "?"}`;
        console.log(`${span.parentSpanId ? "   └ " : "● "}${span.name} — ${detail}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    } catch {
      res.writeHead(400).end();
    }
  });
}).listen(PORT, "127.0.0.1", () => console.log(`Coletor OTLP local em http://127.0.0.1:${PORT}/v1/traces (grava em ${FILE})`));
