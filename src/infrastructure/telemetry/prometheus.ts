/**
 * Métricas Prometheus do agent, tiradas do MESMO trace que o analista vê no console: o que o
 * painel mostra num turno, o Grafana mostra somado. Nenhum texto, pessoa, conversa ou artigo vira
 * rótulo (cardinalidade baixa e sem dado pessoal): só modelo, intenção, ferramenta e modo da busca.
 *
 * Os números ficam na memória do processo. No container (Komodo) o processo é longo e o Prometheus
 * coleta de /api/metrics; na Vercel cada função tem a sua memória, então lá o caminho é o OTLP.
 */
import { timingSafeEqual } from "node:crypto";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";
import type { TelemetrySink, TurnTelemetry } from "@/application/ports";

const SECONDS = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 40];

export class PrometheusTelemetry implements TelemetrySink {
  readonly registry = new Registry();
  private readonly turns = new Counter({ name: "nexo_agent_turns_total", help: "Turnos do agent por modelo, intenção e resultado (ok, error, fallback).", labelNames: ["model", "intent", "outcome"], registers: [this.registry] });
  private readonly turnSeconds = new Histogram({ name: "nexo_agent_turn_duration_seconds", help: "Duração do turno, do início à resposta salva.", labelNames: ["model"], buckets: SECONDS, registers: [this.registry] });
  private readonly tokens = new Counter({ name: "nexo_llm_tokens_total", help: "Tokens do modelo por direção (input, output).", labelNames: ["model", "direction"], registers: [this.registry] });
  private readonly confidence = new Histogram({ name: "nexo_agent_confidence", help: "Confiança registrada pelo agent no entendimento.", buckets: [0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1], registers: [this.registry] });
  private readonly toolCalls = new Counter({ name: "nexo_tool_calls_total", help: "Chamadas de ferramenta do agent.", labelNames: ["tool"], registers: [this.registry] });
  private readonly toolSeconds = new Histogram({ name: "nexo_tool_duration_seconds", help: "Duração de cada chamada de ferramenta.", labelNames: ["tool"], buckets: SECONDS, registers: [this.registry] });
  private readonly guardrails = new Counter({ name: "nexo_guardrails_total", help: "Regras do código que agiram sobre o modelo.", registers: [this.registry] });
  private readonly retrievals = new Counter({ name: "nexo_retrieval_total", help: "Buscas na central por modo (hybrid, keyword) e veredito do avaliador.", labelNames: ["mode", "verdict"], registers: [this.registry] });
  private readonly retrievalSeconds = new Histogram({ name: "nexo_retrieval_duration_seconds", help: "Duração da busca na central (embeddings + avaliador).", buckets: SECONDS, registers: [this.registry] });
  private readonly topSimilarity = new Histogram({ name: "nexo_retrieval_top_similarity", help: "Cosseno do 1º candidato da busca híbrida.", buckets: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], registers: [this.registry] });
  private readonly degraded = new Counter({ name: "nexo_retrieval_degraded_total", help: "Buscas degradadas por componente (embeddings, avaliador).", labelNames: ["component"], registers: [this.registry] });

  constructor({ processMetrics = false } = {}) {
    if (processMetrics) collectDefaultMetrics({ register: this.registry, prefix: "nexo_" });
  }

  async turnFinished({ trace }: TurnTelemetry): Promise<void> {
    const model = trace.model ?? "nenhum";
    const outcome = trace.steps.some((s) => !s.ok) ? "error" : trace.fallbackFrom ? "fallback" : "ok";
    this.turns.inc({ model, intent: trace.decision?.intent ?? "nenhuma", outcome });
    this.turnSeconds.observe({ model }, trace.latencyMs / 1000);
    if (trace.usage) {
      this.tokens.inc({ model, direction: "input" }, trace.usage.inputTokens);
      this.tokens.inc({ model, direction: "output" }, trace.usage.outputTokens);
    }
    if (trace.decision) this.confidence.observe(trace.decision.confidence);
    for (const call of trace.toolCalls) {
      this.toolCalls.inc({ tool: call.tool });
      this.toolSeconds.observe({ tool: call.tool }, call.durationMs / 1000);
    }
    if (trace.guardrails.length) this.guardrails.inc(trace.guardrails.length);
    for (const retrieval of trace.retrievals ?? []) {
      this.retrievals.inc({ mode: retrieval.mode, verdict: retrieval.verdict ?? "sem_avaliador" });
      this.retrievalSeconds.observe(retrieval.latencyMs / 1000);
      const top = retrieval.candidates[0]?.similarity;
      if (top !== null && top !== undefined) this.topSimilarity.observe(top);
      for (const reason of retrieval.degraded) this.degraded.inc({ component: reason.startsWith("avaliador") ? "avaliador" : "embeddings" });
    }
  }
}

/** Manda o turno a todos os destinos; um que falha não segura nem derruba os outros. */
export class CompositeTelemetry implements TelemetrySink {
  constructor(private readonly sinks: TelemetrySink[]) {}

  async turnFinished(turn: TurnTelemetry): Promise<void> {
    await Promise.allSettled(this.sinks.map((sink) => sink.turnFinished(turn)));
  }
}

/** Sem token configurado, o endpoint não existe (404); com ele, só o Bearer exato lê (comparação em tempo constante). */
export function metricsAuthorized(header: string | null, token: string | undefined): "ok" | "denied" | "disabled" {
  if (!token) return "disabled";
  const given = Buffer.from(header?.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected) ? "ok" : "denied";
}

/** Um registro por processo, que sobrevive ao recarregamento do módulo no `next dev`. */
const holder = globalThis as unknown as { nexoPrometheus?: PrometheusTelemetry };
export function processMetrics(): PrometheusTelemetry {
  holder.nexoPrometheus ??= new PrometheusTelemetry({ processMetrics: true });
  return holder.nexoPrometheus;
}
