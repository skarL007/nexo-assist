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
  /** As mais recentes primeiro, até `limit`. */
  listRecent(limit: number): Promise<Conversation[]>;
  insert(conversation: Conversation): Promise<void>;
  /**
   * Grava só se o estado no banco ainda for `expectedStatus` (evita que duas
   * ações ao mesmo tempo se sobrescrevam). Devolve false se outra ação venceu.
   */
  update(conversation: Conversation, expectedStatus: Conversation["status"]): Promise<boolean>;
}

export interface MessageRepository {
  add(message: NewMessage): Promise<ChatMessage>;
  findById(id: string): Promise<ChatMessage | null>;
  listByConversation(conversationId: string): Promise<ChatMessage[]>;
  listRecent(conversationId: string, limit: number): Promise<ChatMessage[]>;
  /** Última mensagem de cada conversa, sem o trace (lista do console). */
  lastByConversations(conversationIds: string[]): Promise<Map<string, ChatMessage>>;
  countByRole(conversationId: string, role: MessageRole): Promise<number>;
  /** Mensagens de um papel no sistema todo desde `since` (teto global de custo). */
  countByRoleSince(role: MessageRole, since: Date): Promise<number>;
  /** Mensagens do funcionário em todas as conversas dele desde `since` (limite por pessoa). */
  countByEmployeeSince(employeeId: string, since: Date): Promise<number>;
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
  listByConversation(conversationId: string): Promise<Draft[]>;
  setStatus(id: number, status: DraftStatus): Promise<void>;
  /**
   * Muda de "pending" para `status` de forma atômica: só um pedido vence.
   * Devolve o rascunho se conseguiu, ou null se ele não estava mais pendente.
   */
  claimPending(id: number, employeeId: string, status: DraftStatus): Promise<Draft | null>;
  /** Marca os pendentes da conversa como "replaced": um rascunho novo vai tomar o lugar deles. */
  replacePending(conversationId: string): Promise<void>;
  /** Descarta os pendentes da conversa (opcionalmente só os criados desde `since`). */
  cancelPending(conversationId: string, since?: Date): Promise<void>;
}

export interface FeedbackRepository {
  /** Uma avaliação por mensagem: avaliar de novo troca a anterior. */
  upsert(feedback: { messageId: string; employeeId: string; helpful: boolean; at: Date }): Promise<void>;
  /** messageId → helpful, das mensagens da conversa. */
  byConversation(conversationId: string): Promise<Record<string, boolean>>;
}

/** Leitura agregada para os indicadores (não muda nada). */
export interface InsightsSource {
  messagesSince(since: Date): Promise<ChatMessage[]>;
  feedbackSince(since: Date): Promise<{ helpful: boolean }[]>;
  draftStatusesSince(since: Date): Promise<{ status: DraftStatus }[]>;
  countAnalysts(): Promise<number>;
}

/** Contadores globais com teto (custo do deploy). */
export interface BudgetRepository {
  /** Soma 1 ao contador se ele estiver abaixo do teto, de forma atômica. false = teto atingido. */
  reserve(key: string, limit: number): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
