/**
 * Relatório da conversa para o analista: o que a pessoa precisa, o que o agent já fez
 * e o que ficou pendente, sem ler o histórico inteiro.
 *
 * Sai só do que está gravado (mensagens, traces, rascunhos e chamados): não chama o
 * modelo, então não gasta o teto e não inventa nada. Datas ficam em ISO; o texto
 * formatado fica com quem mostra (features/console/report-text.ts).
 */
import type { ConversationStatus, HandoffReason } from "./conversation";
import type { Card, ChatMessage, DraftStatus, Intent, TicketSnapshot } from "./message";

export interface ReportInput {
  employee: { name: string; department: string };
  status: ConversationStatus;
  handoff: { reason: HandoffReason; summary: string; confidence: number | null; at: string } | null;
  messages: ChatMessage[];
  /** Chamados do funcionário agora; null se o sistema de chamados não respondeu. */
  tickets: TicketSnapshot[] | null;
  /** Status atual de cada rascunho (o card da mensagem guarda o status de quando foi criado). */
  draftStatuses: Record<number, DraftStatus>;
}

export type PendingItem =
  | { kind: "waiting_analyst"; since: string | null }
  | { kind: "draft"; draftId: number; title: string }
  | { kind: "overdue"; code: string; title: string; deadline: string };

export interface ConversationReport {
  employee: ReportInput["employee"];
  status: ConversationStatus;
  startedAt: string | null;
  lastAt: string | null;
  counts: { employee: number; agent: number; analyst: number };
  /** O que a pessoa precisa, nas palavras mais recentes que temos. */
  need: string | null;
  handoff: ReportInput["handoff"];
  /** Passos do agent que deram certo, sem repetir, na ordem em que aconteceram. */
  actions: string[];
  failures: string[];
  articles: string[];
  /** Chamados citados na conversa; `ticket` null se não há dados dele agora. */
  tickets: { code: string; ticket: TicketSnapshot | null }[];
  lowestConfidence: number | null;
  pending: PendingItem[];
}

const TICKET_CODE = /\b(?:INC|REQ)-\d+\b/g;
/** Intenções que não descrevem o problema ("oi", "sim", "a segunda opção"). */
const NOT_A_NEED: Intent[] = ["greeting", "confirm_or_choose", "unclear"];

export function buildConversationReport(input: ReportInput): ConversationReport {
  const { messages } = input;
  const traces = messages.flatMap((m) => (m.trace ? [m.trace] : []));
  const steps = traces.flatMap((t) => t.steps);
  const confidences = traces.flatMap((t) => (t.decision ? [t.decision.confidence] : []));
  const lastNeed = traces.findLast((t) => t.decision && !NOT_A_NEED.includes(t.decision.intent))?.decision?.understanding;
  const tickets = ticketsCited(input);

  return {
    employee: input.employee,
    status: input.status,
    startedAt: messages[0]?.createdAt ?? null,
    lastAt: messages.at(-1)?.createdAt ?? null,
    counts: {
      employee: messages.filter((m) => m.role === "employee").length,
      agent: messages.filter((m) => m.role === "agent").length,
      analyst: messages.filter((m) => m.role === "analyst").length,
    },
    need: input.handoff?.summary ?? lastNeed ?? messages.find((m) => m.role === "employee")?.text ?? null,
    handoff: input.handoff,
    actions: unique(steps.filter((s) => s.ok).map((s) => s.label)),
    failures: unique(steps.filter((s) => !s.ok).map((s) => s.label)),
    articles: unique(traces.flatMap((t) => t.toolCalls.filter((c) => c.tool === "searchHelpCenter").flatMap((c) => articleTitles(c.output)))),
    tickets,
    lowestConfidence: confidences.length ? Math.min(...confidences) : null,
    pending: pendingOf(input, tickets),
  };
}

function ticketsCited(input: ReportInput): ConversationReport["tickets"] {
  const fromCards = new Map<string, TicketSnapshot>();
  const codes: string[] = [];
  for (const message of input.messages) {
    for (const card of message.cards) {
      if (card.kind === "ticket") fromCards.set(card.ticket.code, card.ticket);
    }
    // Ficam de fora as listas de escolha: mostram todos os chamados, não os da conversa.
    const texts = [message.text, ...message.cards.flatMap(cardText), ...(message.trace?.steps.map((s) => s.label) ?? [])];
    codes.push(...texts.flatMap((text) => text.match(TICKET_CODE) ?? []));
  }
  if (input.handoff) codes.push(...(input.handoff.summary.match(TICKET_CODE) ?? []));
  return unique(codes).map((code) => ({ code, ticket: input.tickets?.find((t) => t.code === code) ?? fromCards.get(code) ?? null }));
}

function cardText(card: Card): string[] {
  if (card.kind === "ticket") return [card.ticket.code];
  if (card.kind === "draft" && card.draft.kind === "update") return [card.draft.fields.ticketCode];
  if (card.kind === "handoff") return [card.summary];
  return [];
}

function pendingOf(input: ReportInput, tickets: ConversationReport["tickets"]): PendingItem[] {
  const pending: PendingItem[] = [];
  if (input.status === "waiting_analyst") pending.push({ kind: "waiting_analyst", since: input.handoff?.at ?? null });

  // O último retrato de cada rascunho dá o título; o status vem de agora.
  const drafts = new Map<number, string>();
  for (const card of input.messages.flatMap((m) => m.cards)) {
    if (card.kind !== "draft") continue;
    const { draft } = card;
    drafts.set(draft.id, draft.kind === "create" ? draft.fields.title : `Atualização do ${draft.fields.ticketCode}`);
  }
  for (const [draftId, title] of drafts) {
    if (input.draftStatuses[draftId] === "pending") pending.push({ kind: "draft", draftId, title });
  }

  for (const { code, ticket } of tickets) {
    if (ticket?.overdue && ticket.deadline) pending.push({ kind: "overdue", code, title: ticket.title, deadline: ticket.deadline });
  }
  return pending;
}

/** Saída da tool searchHelpCenter: { articles: [{ title }] }. Vem do banco como JSON, então confere o formato. */
function articleTitles(output: unknown): string[] {
  const articles = (output as { articles?: unknown } | null)?.articles;
  if (!Array.isArray(articles)) return [];
  return articles.flatMap((a) => (typeof (a as { title?: unknown })?.title === "string" ? [(a as { title: string }).title] : []));
}

const unique = <T,>(items: T[]) => [...new Set(items)];
