/**
 * Portas: o que a aplicação precisa de fora (banco), descrito como interfaces.
 * A infraestrutura implementa; os testes usam versões em memória.
 */
import type { FrustrationSignal } from "@/domain/frustration";
import type { Conversation } from "@/domain/conversation";
import type { Employee } from "@/domain/employee";
import type { SuggestionOutcome } from "@/domain/reply-suggestion";
import type { Article } from "@/domain/knowledge";
import type { Card, ChatMessage, DraftKind, DraftStatus, MessageRole, NewTicketFields, TicketUpdateFields, TurnTrace } from "@/domain/message";
import type { Priority, Ticket, TicketStatus, TicketType } from "@/domain/ticket";

export interface EmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: string): Promise<Employee | null>;
  listByIds(ids: string[]): Promise<Employee[]>;
}

export interface ArticleRepository {
  listAll(): Promise<Article[]>;
  /** Vetores já calculados para o modelo, por artigo, com o hash do texto de quando foram calculados. */
  embeddings(model: string): Promise<Map<string, { vector: number[]; contentHash: string }>>;
  saveEmbeddings(model: string, items: { articleId: string; vector: number[]; contentHash: string }[]): Promise<void>;
}

/** Veredito do avaliador: o id do candidato que se aplica, ou do que talvez se aplique (falta um detalhe), ou nenhum. */
export interface RelevanceVerdict {
  applies: string | null;
  maybe: string | null;
}

/** Decide qual candidato da busca se aplica à mensagem (Corrective RAG). */
export interface RelevanceJudge {
  readonly model: string;
  judge(query: string, candidates: Article[]): Promise<RelevanceVerdict>;
}

/** Transforma texto em vetores (embeddings). "query" e "document" pedem tarefas diferentes ao modelo. */
export interface Embedder {
  readonly model: string;
  embed(texts: string[], kind: "query" | "document"): Promise<number[][]>;
}

export interface TicketRepository {
  findByCode(code: string): Promise<Ticket | null>;
  listByOwner(ownerId: string): Promise<Ticket[]>;
  /** Abertos de todo mundo criados desde `since` (incidente em massa). */
  listOpenCreatedSince(since: Date): Promise<Ticket[]>;
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
  /** Frustração do último entendimento do agent em cada conversa (fila do console). */
  lastFrustrations(conversationIds: string[]): Promise<Map<string, FrustrationSignal>>;
  countByRole(conversationId: string, role: MessageRole): Promise<number>;
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
/** Um turno do agent terminado, para observabilidade externa (OpenTelemetry/Langfuse). */
export interface TurnTelemetry {
  conversationId: string;
  employeeId: string;
  startedAt: Date;
  trace: TurnTrace;
  /** Texto do funcionário e resposta: só saem com a captura de conteúdo ligada. */
  input: string;
  output: string;
}

export interface TelemetrySink {
  /** Nunca lança: falha de envio não pode derrubar o turno. */
  turnFinished(turn: TurnTelemetry): Promise<void>;
}

/**
 * Assinaturas baratas do estado (tempo real). Mudam quando algo que a tela mostra muda;
 * o valor em si não importa, só se é diferente do anterior.
 */
export interface ChangeFeed {
  /** Tudo o que o console mostra: conversas, mensagens, chamados, rascunhos e avaliações. */
  consoleVersion(): Promise<string>;
  /** A conversa mais recente do funcionário e as mensagens dela. */
  employeeVersion(employeeId: string): Promise<string>;
}

export interface InsightsSource {
  messagesSince(since: Date): Promise<ChatMessage[]>;
  feedbackSince(since: Date): Promise<{ helpful: boolean; messageId: string; conversationId: string }[]>;
  draftStatusesSince(since: Date): Promise<{ status: DraftStatus; conversationId: string }[]>;
  /** Dono de cada conversa (resolução honesta: "voltou com o mesmo problema" é da mesma pessoa). */
  conversationOwners(ids: string[]): Promise<{ id: string; employeeId: string }[]>;
  countAnalysts(): Promise<number>;
  /** Chamados abertos de todo mundo, com o nome de quem abriu (fila de prazos do console). */
  openTickets(): Promise<{ code: string; title: string; priority: Priority; status: TicketStatus; updatedAt: Date; ownerName: string }[]>;
}

/** Escreve a sugestão de resposta do analista (o modelo). */
export interface ReplyWriter {
  write(input: { context: string; analystFirstName: string }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } | null }>;
}

export interface SuggestionRepository {
  record(event: { conversationId: string; analystId: string; outcome: SuggestionOutcome; at: Date }): Promise<void>;
  countsSince(since: Date): Promise<Record<SuggestionOutcome, number>>;
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
