/** Implementações em memória das portas, usadas só nos testes. */
import type { Conversation } from "@/domain/conversation";
import type { ChatMessage, DraftStatus, MessageRole } from "@/domain/message";
import type { Ticket, TicketType } from "@/domain/ticket";
import type {
  Clock,
  ConversationRepository,
  Draft,
  DraftRepository,
  MessageRepository,
  NewMessage,
  TicketRepository,
} from "./ports";

export class InMemoryTicketRepository implements TicketRepository {
  readonly tickets = new Map<string, Ticket>();
  readonly comments: { ticketCode: string; text: string }[] = [];
  private sequence = 30000;

  constructor(initial: Ticket[] = []) {
    initial.forEach((t) => this.tickets.set(t.code, t));
  }

  async findByCode(code: string) {
    return this.tickets.get(code) ?? null;
  }
  async listByOwner(ownerId: string) {
    return [...this.tickets.values()].filter((t) => t.ownerId === ownerId);
  }
  async nextCode(type: TicketType) {
    return `${type}-${++this.sequence}`;
  }
  async insert(ticket: Ticket) {
    this.tickets.set(ticket.code, ticket);
  }
  async update(ticket: Ticket) {
    this.tickets.set(ticket.code, ticket);
  }
  async addComment(ticketCode: string, _author: string, text: string) {
    this.comments.push({ ticketCode, text });
  }
}

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const at = new Date("2026-10-20T13:00:00Z");
  return {
    code: "INC-20311",
    type: "INC",
    title: "Notebook lento após atualização do Windows",
    description: "Lentidão geral desde a atualização.",
    category: "hardware",
    priority: "medium",
    status: "waiting_analyst",
    impact: "me",
    ownerId: "ana",
    createdAt: at,
    updatedAt: at,
    resolvedAt: null,
    ...overrides,
  };
}

export class InMemoryConversationRepository implements ConversationRepository {
  readonly items = new Map<string, Conversation>();
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findLatestOpenByEmployee(employeeId: string) {
    return [...this.items.values()].find((c) => c.employeeId === employeeId && c.status !== "closed") ?? null;
  }
  async listRecent(limit: number) {
    return [...this.items.values()].slice(0, limit);
  }
  async insert(conversation: Conversation) {
    this.items.set(conversation.id, conversation);
  }
  async update(conversation: Conversation, expectedStatus: Conversation["status"]) {
    if (this.items.get(conversation.id)?.status !== expectedStatus) return false;
    this.items.set(conversation.id, conversation);
    return true;
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  readonly items: ChatMessage[] = [];
  async add(message: NewMessage) {
    const saved: ChatMessage = {
      id: String(this.items.length + 1),
      conversationId: message.conversationId,
      role: message.role,
      authorName: message.authorName ?? null,
      text: message.text,
      cards: message.cards ?? [],
      trace: message.trace ?? null,
      createdAt: new Date().toISOString(),
    };
    this.items.push(saved);
    return saved;
  }
  async listByConversation(conversationId: string) {
    return this.items.filter((m) => m.conversationId === conversationId);
  }
  async listRecent(conversationId: string, limit: number) {
    return (await this.listByConversation(conversationId)).slice(-limit);
  }
  async lastByConversations(ids: string[]) {
    return new Map(ids.map((id) => [id, this.items.filter((m) => m.conversationId === id).at(-1)!]));
  }
  async countByRole(conversationId: string, role: MessageRole) {
    return this.items.filter((m) => m.conversationId === conversationId && m.role === role).length;
  }
  async countByRoleSince(role: MessageRole) {
    return this.items.filter((m) => m.role === role).length;
  }
  async countModelReplies() {
    return this.items.filter((m) => m.role === "agent" && m.trace?.usage).length;
  }
  async countByEmployeeSince() {
    return this.items.filter((m) => m.role === "employee").length;
  }
}

export class InMemoryDraftRepository implements DraftRepository {
  readonly items: Draft[] = [];
  async insert(draft: Omit<Draft, "id">) {
    const saved = { ...draft, id: this.items.length + 1 };
    this.items.push(saved);
    return saved;
  }
  async findById(id: number) {
    return this.items.find((d) => d.id === id) ?? null;
  }
  async listByConversation(conversationId: string) {
    return this.items.filter((d) => d.conversationId === conversationId);
  }
  async setStatus(id: number, status: DraftStatus) {
    const draft = this.items.find((d) => d.id === id);
    if (draft) draft.status = status;
  }
  async claimPending(id: number, employeeId: string, status: DraftStatus) {
    const draft = this.items.find((d) => d.id === id && d.employeeId === employeeId && d.status === "pending");
    if (!draft) return null;
    draft.status = status;
    return { ...draft };
  }
  async cancelPending(conversationId: string, since?: Date) {
    for (const d of this.items) {
      if (d.conversationId === conversationId && d.status === "pending" && (!since || d.createdAt >= since)) d.status = "cancelled";
    }
  }
}
