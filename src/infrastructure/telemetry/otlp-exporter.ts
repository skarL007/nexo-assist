/**
 * Exportador opcional de traces (OTLP/HTTP com JSON). Desligado sem configuração.
 * Nunca derruba o turno: erro ou demora viram só um log.
 */
import { randomBytes } from "node:crypto";
import type { TelemetrySink, TurnTelemetry } from "@/application/ports";
import { turnToOtlp } from "./otlp-mapping";

export interface TelemetryConfig {
  endpoint: string;
  headers: Record<string, string>;
  captureContent: boolean;
}

export interface TelemetryEnv {
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_TRACES_HEADERS?: string;
  OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT?: boolean;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
}

const LANGFUSE_CLOUD = "https://cloud.langfuse.com";

/** "chave=valor,chave2=valor2" (formato da variável padrão do OpenTelemetry). */
function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  return Object.fromEntries(
    raw
      .split(",")
      .map((pair) => pair.split("="))
      .filter((parts) => parts.length >= 2 && parts[0].trim())
      .map(([key, ...value]) => [decodeURIComponent(key.trim()), decodeURIComponent(value.join("=").trim())]),
  );
}

/** Langfuse (atalho com as chaves dele) ou qualquer endpoint OTLP. Sem nada, null. */
export function telemetryConfig(env: TelemetryEnv): TelemetryConfig | null {
  const captureContent = env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT ?? false;
  if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY) {
    const base = (env.LANGFUSE_BASE_URL ?? LANGFUSE_CLOUD).replace(/\/+$/, "");
    const basic = Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString("base64");
    return {
      endpoint: `${base}/api/public/otel/v1/traces`,
      headers: { Authorization: `Basic ${basic}`, "x-langfuse-ingestion-version": "4" },
      captureContent,
    };
  }
  if (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return { endpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, headers: parseHeaders(env.OTEL_EXPORTER_OTLP_TRACES_HEADERS), captureContent };
  }
  return null;
}

export class OtlpTraceExporter implements TelemetrySink {
  constructor(
    private readonly config: TelemetryConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 2000,
    private readonly log: (message: string) => void = (message) => console.error(message),
  ) {}

  async turnFinished(turn: TurnTelemetry): Promise<void> {
    const payload = turnToOtlp(turn, { captureContent: this.config.captureContent, randomHex: (n) => randomBytes(n).toString("hex") });
    try {
      const response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.config.headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) this.log(`[telemetria] o coletor respondeu ${response.status}`);
    } catch (error) {
      this.log(`[telemetria] envio falhou: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
