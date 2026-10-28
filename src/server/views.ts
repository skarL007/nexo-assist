/** Monta as respostas da API (contracts) a partir dos serviços. */
import { currentFrustration, type FrustrationSignal } from "@/domain/frustration";
import type { ConsoleConversationDetail, ConsoleConversationSummary, ConversationView, SlaAlertView } from "@/contracts/chat";
import { MESSAGE_LIMIT_PER_SESSION, type Conversation } from "@/domain/conversation";
import type { Employee } from "@/domain/employee";
import type { ChatMessage, TicketSnapshot } from "@/domain/message";
import { slaRisk } from "@/domain/sla-risk";
import { explainSla } from "@/lib/sla-text";
import type { Services } from "@/infrastructure/container";
import { logError } from "./http";

export async function conversationView(services: Services, conversation: Conversation | null): Promise<ConversationView> {
  if (!conversation) {
    return {
      id: null,
      status: "with_agent",
      analystName: null,
      remainingMessages: MESSAGE_LIMIT_PER_SESSION,
      messageLimit: MESSAGE_LIMIT_PER_SESSION,
      draftStatuses: {},
      feedback: {},
      messages: [],
    };
  }
  const [messages, remainingMessages, draftStatuses, feedback, analyst] = await Promise.all([
    services.messages.listByConversation(conversation.id),
    services.conversations.remainingMessages(conversation.id),
    services.drafts.statuses(conversation.id),
    services.feedback.byConversation(conversation.id),
    conversation.analystId ? services.employees.findById(conversation.analystId) : null,
  ]);
  return {
    id: conversation.id,
    status: conversation.status,
    analystName: analyst?.name ?? null,
    remainingMessages,
    messageLimit: MESSAGE_LIMIT_PER_SESSION,
    draftStatuses,
    feedback,
    messages,
  };
}

function summary(
  conversation: Conversation,
  people: Map<string, Employee>,
  last: ChatMessage | undefined,
  frustration: FrustrationSignal | null,
): ConsoleConversationSummary {
  const employee = people.get(conversation.employeeId);
  const analyst = conversation.analystId ? people.get(conversation.analystId) : undefined;
  return {
    id: conversation.id,
    employee: { id: conversation.employeeId, name: employee?.name ?? "—", department: employee?.department ?? "" },
    status: conversation.status,
    analyst: analyst ? { id: analyst.id, name: analyst.name } : null,
    handoffReason: conversation.handoff?.reason ?? null,
    handoffConfidence: conversation.handoff?.confidence ?? null,
    handoffAt: conversation.handoff?.at.toISOString() ?? null,
    lastMessage: last ? { role: last.role, text: last.text, at: last.createdAt } : null,
    ticketCode: conversation.handoff?.ticketCode ?? null,
    frustration,
  };
}

async function peopleOf(services: Services, conversations: Conversation[]) {
  const ids = [...new Set(conversations.flatMap((c) => [c.employeeId, c.analystId].filter((id): id is string => !!id)))];
  const people = await services.employees.listByIds(ids);
  return new Map(people.map((p) => [p.id, p]));
}

export async function consoleList(services: Services, conversations: Conversation[]): Promise<ConsoleConversationSummary[]> {
  const ids = conversations.map((c) => c.id);
  const [people, lastMessages, frustrations] = await Promise.all([
    peopleOf(services, conversations),
    services.messages.lastByConversations(ids),
    services.messages.lastFrustrations(ids),
  ]);
  // Conversas sem mensagem (abertas e abandonadas) não interessam ao analista.
  return conversations.filter((c) => lastMessages.has(c.id)).map((c) => summary(c, people, lastMessages.get(c.id), frustrations.get(c.id) ?? null));
}

export async function consoleDetail(services: Services, conversation: Conversation): Promise<ConsoleConversationDetail> {
  const [people, messages, draftStatuses, feedback, tickets] = await Promise.all([
    peopleOf(services, [conversation]),
    services.messages.listByConversation(conversation.id),
    services.drafts.statuses(conversation.id),
    services.feedback.byConversation(conversation.id),
    // Os chamados vêm do sistema legado, que às vezes cai: a conversa (banco local) abre mesmo assim.
    services.tickets.listMine(conversation.employeeId).catch((error: unknown) => {
      logError(error);
      return null;
    }),
  ]);
  const snapshots = tickets ? tickets.map((t) => services.tickets.snapshot(t)) : null;
  return {
    ...summary(conversation, people, messages.at(-1), currentFrustration(messages)),
    handoffSummary: conversation.handoff?.summary ?? null,
    messages,
    draftStatuses,
    feedback,
    tickets: snapshots,
    slaAlerts: snapshots ? slaAlerts(snapshots, new Date()) : [],
  };
}

/** Vencidos primeiro (mais atrasado no topo), depois os em risco (o que vence antes no topo). */
export function slaAlerts(tickets: TicketSnapshot[], now: Date): SlaAlertView[] {
  return tickets
    .flatMap((t) => {
      const risk = slaRisk({ code: t.code, title: t.title, priority: t.priority, status: t.status, updatedAt: new Date(t.updatedAt) }, now);
      return risk ? [risk] : [];
    })
    .sort((a, b) => (a.level === b.level ? (a.level === "overdue" ? b.overdueMs - a.overdueMs : a.remainingMs - b.remainingMs) : a.level === "overdue" ? -1 : 1))
    .map((risk) => ({ code: risk.code, title: risk.title, level: risk.level, ...explainSla(risk) }));
}
