/**
 * Indicadores do atendimento: quanto o agent resolve sozinho, por que transfere,
 * quanto demora, quanto custa e o que os funcionários acham das respostas.
 *
 * Tudo sai do que já está gravado (mensagens com trace, rascunhos e feedback).
 * Taxa sem dado nenhum é null: a tela mostra "—" em vez de um 0% enganoso.
 */
import { HANDOFF_REASONS, LOW_CONFIDENCE, type HandoffReason } from "./conversation";
import type { ChatMessage, DraftStatus } from "./message";
import type { KnowledgeGap } from "./knowledge-gaps";
import type { SuggestionOutcome } from "./reply-suggestion";
import type { ResolutionSummary } from "./resolution";

export interface InsightsInput {
  messages: Pick<ChatMessage, "conversationId" | "role" | "cards" | "trace" | "createdAt">[];
  feedback: { helpful: boolean }[];
  drafts: { status: DraftStatus }[];
  analysts: number;
  /** Preço por token do modelo (US$), ou null se o modelo não tem preço conhecido. */
  price: { input: number; output: number } | null;
  /** Sugestões de resposta do analista por resultado (null: não medido). */
  suggestions?: Record<SuggestionOutcome, number> | null;
}

export interface Insights {
  conversations: number;
  /** Fração das conversas que terminaram sem analista (sem transferência nem resposta humana). */
  resolvedWithoutHuman: number | null;
  handoffs: { reason: HandoffReason; count: number }[];
  agentTurns: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  avgConfidence: number | null;
  lowConfidenceRate: number | null;
  tokens: { input: number; output: number };
  costUsd: number | null;
  costPerConversationUsd: number | null;
  feedback: { helpful: number; notHelpful: number; rate: number | null };
  drafts: { confirmed: number; cancelled: number; pending: number; confirmRate: number | null };
  analysts: number;
  /** Sugestões geradas e quantas foram enviadas sem editar (fração das enviadas). */
  suggestions: { generated: number; sentAsIs: number; sentEdited: number; asIsRate: number | null };
}

/** Indicadores + resolução honesta e lacunas da central (montados no InsightsService). */
export type InsightsReport = Insights & { resolution: ResolutionSummary; knowledgeGaps: KnowledgeGap[] };

export function computeInsights(input: InsightsInput): Insights {
  const byConversation = Map.groupBy(input.messages, (m) => m.conversationId);
  const withEmployee = [...byConversation.values()].filter((msgs) => msgs.some((m) => m.role === "employee"));
  const neededHuman = withEmployee.filter((msgs) => msgs.some((m) => m.role === "analyst" || m.cards.some((c) => c.kind === "handoff")));

  const handoffCounts = new Map<HandoffReason, number>();
  for (const card of input.messages.flatMap((m) => m.cards)) {
    if (card.kind === "handoff") handoffCounts.set(card.reason, (handoffCounts.get(card.reason) ?? 0) + 1);
  }

  // Só turnos do modelo: respostas do próprio sistema (Confirmar, Alterar detalhes) têm model null e levariam o tempo médio a zero.
  const traces = input.messages.flatMap((m) => (m.role === "agent" && m.trace?.model ? [m.trace] : []));
  const latencies = traces.map((t) => t.latencyMs).sort((a, b) => a - b);
  const confidences = traces.flatMap((t) => (t.decision ? [t.decision.confidence] : []));
  const tokens = {
    input: traces.reduce((sum, t) => sum + (t.usage?.inputTokens ?? 0), 0),
    output: traces.reduce((sum, t) => sum + (t.usage?.outputTokens ?? 0), 0),
  };
  const costUsd = input.price && traces.length ? tokens.input * input.price.input + tokens.output * input.price.output : null;

  const helpful = input.feedback.filter((f) => f.helpful).length;
  const notHelpful = input.feedback.length - helpful;
  const count = (status: DraftStatus) => input.drafts.filter((d) => d.status === status).length;
  const [confirmed, cancelled, pending] = [count("confirmed"), count("cancelled"), count("pending")];

  return {
    conversations: withEmployee.length,
    resolvedWithoutHuman: ratio(withEmployee.length - neededHuman.length, withEmployee.length),
    handoffs: HANDOFF_REASONS.map((reason) => ({ reason, count: handoffCounts.get(reason) ?? 0 })),
    agentTurns: traces.length,
    avgLatencyMs: latencies.length ? Math.round(average(latencies)) : null,
    p95LatencyMs: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null,
    avgConfidence: confidences.length ? average(confidences) : null,
    lowConfidenceRate: ratio(confidences.filter((c) => c < LOW_CONFIDENCE).length, confidences.length),
    tokens,
    costUsd,
    costPerConversationUsd: costUsd !== null && withEmployee.length ? costUsd / withEmployee.length : null,
    feedback: { helpful, notHelpful, rate: ratio(helpful, input.feedback.length) },
    drafts: { confirmed, cancelled, pending, confirmRate: ratio(confirmed, confirmed + cancelled) },
    analysts: input.analysts,
    suggestions: {
      generated: input.suggestions?.generated ?? 0,
      sentAsIs: input.suggestions?.sent_as_is ?? 0,
      sentEdited: input.suggestions?.sent_edited ?? 0,
      asIsRate: ratio(input.suggestions?.sent_as_is ?? 0, (input.suggestions?.sent_as_is ?? 0) + (input.suggestions?.sent_edited ?? 0)),
    },
  };
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const ratio = (part: number, total: number) => (total ? part / total : null);
