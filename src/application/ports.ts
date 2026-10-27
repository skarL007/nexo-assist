/**
 * Portas: o que a aplicação precisa de fora (banco), descrito como interfaces.
 * A infraestrutura implementa; os testes usam versões em memória.
 */
import type { Conversation } from "@/domain/conversation";
import type { Employee } from "@/domain/employee";
import type { Article } from "@/domain/knowledge";
import type { Card, ChatMessage, DraftKind, DraftStatus, MessageRole, NewTicketFields, TicketUpdateFields, TurnTrace } from "@/domain/message";
import type { Ticket, TicketType } from "@/domain/ticket";

export interface EmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: string): Promise<Employee | null>;
  listByIds(ids: string[]): Promise<Employee[]>;
}

export interface ArticleRepository {
  listAll(): Promise<Article[]>;
}

export interface TicketRepository {
  findByCode(code: string): Promise<Ticket | null>;
  listByOwner(ownerId: string): Promise<Ticket[]>;
  nextCode(type: TicketType): Promise<string>;
  insert(ticket: Ticket): Promise<void>;
  update(ticket: Ticket): Promise<void>;
  addComment(ticketCode: string, author: string, text: string, at: Date): Promise<void>;
}

export interface NewMessage {
  conversationId: string;
  role: MessageRole;
  authorName?: string | null;
  text: string;
  cards?: Card[];
  trace?: TurnTrace | null;
}

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findLatestOpenByEmployee(employeeId: string): Promise<Conversation | null>;
  listAll(): Promise<Conversation[]>;
  insert(conversation: Conversation): Promise<void>;
  update(conversation: Conversation): Promise<void>;
}

export interface MessageRepository {
  add(message: NewMessage): Promise<ChatMessage>;
  listByConversation(conversationId: string): Promise<ChatMessage[]>;
  listRecent(conversationId: string, limit: number): Promise<ChatMessage[]>;
  lastByConversations(conversationIds: string[]): Promise<Map<string, ChatMessage>>;
  countByRole(conversationId: string, role: MessageRole): Promise<number>;
  countByRoleSince(role: MessageRole, since: Date): Promise<number>;
}

export interface Draft {
  id: number;
  conversationId: string;
  employeeId: string;
  kind: DraftKind;
  status: DraftStatus;
  fields: NewTicketFields | TicketUpdateFields;
  createdAt: Date;
}

export interface DraftRepository {
  insert(draft: Omit<Draft, "id">): Promise<Draft>;
  findById(id: number): Promise<Draft | null>;
  findPendingByConversation(conversationId: string): Promise<Draft[]>;
  setStatus(id: number, status: DraftStatus): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
