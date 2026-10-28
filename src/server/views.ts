/** Monta as respostas da API (contracts) a partir dos serviços. */
import type { ConsoleConversationDetail, ConsoleConversationSummary, ConversationView } from "@/contracts/chat";
import { MESSAGE_LIMIT_PER_SESSION, type Conversation } from "@/domain/conversation";
import type { Employee } from "@/domain/employee";
import type { ChatMessage } from "@/domain/message";
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
      messages: [],
    };
  }
  const [messages, remainingMessages, draftStatuses, analyst] = await Promise.all([
    services.messages.listByConversation(conversation.id),
    services.conversations.remainingMessages(conversation.id),
    services.drafts.statuses(conversation.id),
    conversation.analystId ? services.employees.findById(conversation.analystId) : null,
  ]);
  return {
    id: conversation.id,
    status: conversation.status,
    analystName: analyst?.name ?? null,
    remainingMessages,
    messageLimit: MESSAGE_LIMIT_PER_SESSION,
    draftStatuses,
    messages,
  };
}

function summary(conversation: Conversation, people: Map<string, Employee>, last: ChatMessage | undefined): ConsoleConversationSummary {
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
  };
}

async function peopleOf(services: Services, conversations: Conversation[]) {
  const ids = [...new Set(conversations.flatMap((c) => [c.employeeId, c.analystId].filter((id): id is string => !!id)))];
  const people = await services.employees.listByIds(ids);
  return new Map(people.map((p) => [p.id, p]));
}

export async function consoleList(services: Services, conversations: Conversation[]): Promise<ConsoleConversationSummary[]> {
  const [people, lastMessages] = await Promise.all([
    peopleOf(services, conversations),
    services.messages.lastByConversations(conversations.map((c) => c.id)),
  ]);
  // Conversas sem mensagem (abertas e abandonadas) não interessam ao analista.
  return conversations.filter((c) => lastMessages.has(c.id)).map((c) => summary(c, people, lastMessages.get(c.id)));
}

export async function consoleDetail(services: Services, conversation: Conversation): Promise<ConsoleConversationDetail> {
  const [people, messages, tickets] = await Promise.all([
    peopleOf(services, [conversation]),
    services.messages.listByConversation(conversation.id),
    // Os chamados vêm do sistema legado, que às vezes cai: a conversa (banco local) abre mesmo assim.
    services.tickets.listMine(conversation.employeeId).catch((error: unknown) => {
      logError(error);
      return null;
    }),
  ]);
  return {
    ...summary(conversation, people, messages.at(-1)),
    handoffSummary: conversation.handoff?.summary ?? null,
    messages,
    tickets: tickets ? tickets.map((t) => services.tickets.snapshot(t)) : null,
  };
}
