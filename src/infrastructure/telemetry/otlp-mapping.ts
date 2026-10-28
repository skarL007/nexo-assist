/**
 * Turno do agent → spans OTLP/JSON com as convenções GenAI do OpenTelemetry
 * (gen_ai.*). Serve para qualquer backend OTLP (Langfuse, Phoenix, Honeycomb,
 * um collector). Sem conteúdo por padrão: texto do funcionário, resposta e
 * argumentos das tools só saem com `captureContent` (dado pessoal).
 */
import { createHash } from "node:crypto";
import type { TurnTelemetry } from "@/application/ports";

type AttributeValue = { stringValue: string } | { intValue: string } | { doubleValue: number } | { boolValue: boolean };
interface Attribute {
  key: string;
  value: AttributeValue;
}
export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attribute[];
  status: { code: number };
}
export interface OtlpPayload {
  resourceSpans: { resource: { attributes: Attribute[] }; scopeSpans: { scope: { name: string }; spans: OtlpSpan[] }[] }[];
}

const SPAN_KIND_INTERNAL = 1;
const SPAN_KIND_CLIENT = 3;
const STATUS_OK = 1;
const STATUS_ERROR = 2;

function attr(key: string, value: string | number | boolean | null | undefined): Attribute[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [{ key, value: { stringValue: value } }];
  if (typeof value === "boolean") return [{ key, value: { boolValue: value } }];
  return [{ key, value: Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value } }];
}

const nanos = (ms: number) => `${BigInt(Math.round(ms)) * BigInt(1_000_000)}`;
const json = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

/** Id estável e sem identificar a pessoa: dá para agrupar por usuário sem mandar quem é. */
export function pseudonym(employeeId: string): string {
  return createHash("sha256").update(`nexo:${employeeId}`).digest("hex").slice(0, 16);
}

/** "google/gemini-3.5-flash" → provedor "google", modelo "gemini-3.5-flash". */
function splitModel(model: string | null): { provider?: string; name?: string } {
  if (!model) return {};
  const slash = model.indexOf("/");
  return slash < 0 ? { name: model } : { provider: model.slice(0, slash), name: model.slice(slash + 1) };
}

export function turnToOtlp(turn: TurnTelemetry, options: { captureContent: boolean; randomHex: (bytes: number) => string }): OtlpPayload {
  const { trace } = turn;
  const traceId = options.randomHex(16);
  const rootId = options.randomHex(8);
  const start = turn.startedAt.getTime();
  const end = start + trace.latencyMs;
  const { provider, name } = splitModel(trace.model);
  const content = options.captureContent;

  const root: OtlpSpan = {
    traceId,
    spanId: rootId,
    name: "invoke_agent nexo-assist",
    kind: SPAN_KIND_CLIENT,
    startTimeUnixNano: nanos(start),
    endTimeUnixNano: nanos(end),
    status: { code: trace.steps.some((s) => !s.ok) ? STATUS_ERROR : STATUS_OK },
    attributes: [
      ...attr("gen_ai.operation.name", "invoke_agent"),
      ...attr("gen_ai.agent.name", "nexo-assist"),
      ...attr("gen_ai.provider.name", provider),
      ...attr("gen_ai.request.model", name),
      ...attr("gen_ai.conversation.id", turn.conversationId),
      ...attr("gen_ai.usage.input_tokens", trace.usage?.inputTokens),
      ...attr("gen_ai.usage.output_tokens", trace.usage?.outputTokens),
      ...attr("langfuse.session.id", turn.conversationId),
      ...attr("langfuse.user.id", pseudonym(turn.employeeId)),
      ...attr("nexo.intent", trace.decision?.intent),
      ...attr("nexo.confidence", trace.decision?.confidence),
      ...attr("nexo.guardrails", trace.guardrails.length),
      ...attr("nexo.tool_calls", trace.toolCalls.length),
      ...(content
        ? [...attr("langfuse.observation.input", turn.input), ...attr("langfuse.observation.output", turn.output), ...attr("nexo.understanding", trace.decision?.understanding)]
        : []),
    ],
  };

  // O trace guarda só a duração de cada tool: os spans ficam em sequência a partir do início (aproximado).
  let cursor = start;
  const tools: OtlpSpan[] = trace.toolCalls.map((call) => {
    const span: OtlpSpan = {
      traceId,
      spanId: options.randomHex(8),
      parentSpanId: rootId,
      name: `execute_tool ${call.tool}`,
      kind: SPAN_KIND_INTERNAL,
      startTimeUnixNano: nanos(cursor),
      endTimeUnixNano: nanos(cursor + call.durationMs),
      status: { code: STATUS_OK },
      attributes: [
        ...attr("gen_ai.operation.name", "execute_tool"),
        ...attr("gen_ai.tool.name", call.tool),
        ...attr("nexo.timing", "approximate"),
        ...(content ? [...attr("gen_ai.tool.call.arguments", json(call.input)), ...attr("gen_ai.tool.call.result", json(call.output))] : []),
      ],
    };
    cursor += call.durationMs;
    return span;
  });

  return {
    resourceSpans: [
      {
        resource: { attributes: [...attr("service.name", "nexo-assist")] },
        scopeSpans: [{ scope: { name: "nexo-assist.agent" }, spans: [root, ...tools] }],
      },
    ],
  };
}
