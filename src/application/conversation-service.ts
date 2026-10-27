/**
 * Conversas — quem está atendendo, transferências e mensagens de analista.
 * As transições passam pela máquina de estados do domínio; cada mudança
 * deixa uma mensagem de sistema no histórico (é o que aparece como divisória).
 */
import { randomUUID } from "node:crypto";
import {
  HANDOFF_REASON_LABEL,
  MESSAGE_LIMIT_PER_SESSION,
  nextStatus,
  type Conversation,
  type ConversationAction,
  type Handoff,
} from "@/domain/conversation";
import { firstName, type Employee } from "@/domain/employee";
import { DomainError } from "@/domain/errors";
import type { ChatMessage } from "@/domain/message";
import { systemClock, type Clock, type ConversationRepository, type MessageRepository } from "./ports";

export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Conversa aberta do funcionário — é o que permite voltar outro dia (história 6). */
  async findOpen(employeeId: string): Promise<Conversation | null> {
    return this.conversations.findLatestOpenByEmployee(employeeId);
  }

  /** Para o console do analista: as mais recentes, com teto para não ler a tabela inteira. */
  async listRecent(limit = 200): Promise<Conversation[]> {
    return this.conversations.listRecent(limit);
  }

  async getOrStart(employeeId: string): Promise<Conversation> {
    return (await this.findOpen(employeeId)) ?? this.start(employeeId);
  }

  /** "Nova conversa": encerra a atual; a próxima mensagem abre outra sessão. Devolve a encerrada. */
  async closeOpen(employeeId: string): Promise<Conversation | null> {
    const current = await this.findOpen(employeeId);
    if (!current) return null;
    const closed = await this.save(current, nextStatus(current.status, "close"));
    await this.messages.add({ conversationId: current.id, role: "system", text: "Conversa encerrada pelo funcionário" });
    return closed;
  }

  /** Busca a conversa garantindo que é do funcionário (privacidade). */
  async getForEmployee(employeeId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation || conversation.employeeId !== employeeId) {
      throw new DomainError("not_found", "Conversa não encontrada.");
    }
    return conversation;
  }

  async get(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) throw new DomainError("not_found", "Conversa não encontrada.");
    return conversation;
  }

  async remainingMessages(conversationId: string): Promise<number> {
    const sent = await this.messages.countByRole(conversationId, "employee");
    return Math.max(0, MESSAGE_LIMIT_PER_SESSION - sent);
  }

  async handoff(conversationId: string, handoff: Omit<Handoff, "at">): Promise<Conversation> {
    const conversation = await this.get(conversationId);
    const updated = await this.save(conversation, nextStatus(conversation.status, "handoff"), {
      handoff: { ...handoff, at: this.clock.now() },
    });
    await this.messages.add({
      conversationId,
      role: "system",
      text: `Transferido para o service desk · ${HANDOFF_REASON_LABEL[handoff.reason]}`,
      cards: [{ kind: "handoff", reason: handoff.reason, summary: handoff.summary }],
    });
    return updated;
  }

  async assume(conversationId: string, analyst: Employee): Promise<Conversation> {
    return this.analystAction(conversationId, analyst, "assume", `${analyst.name} assumiu · agent pausado`);
  }

  async release(conversationId: string, analyst: Employee): Promise<Conversation> {
    return this.analystAction(conversationId, analyst, "release", `${firstName(analyst.name)} devolveu a conversa ao Nexo Assist`);
  }

  async close(conversationId: string, analyst: Employee): Promise<Conversation> {
    return this.analystAction(conversationId, analyst, "close", `Atendimento encerrado por ${firstName(analyst.name)}`);
  }

  async postAnalystMessage(conversationId: string, analyst: Employee, text: string): Promise<ChatMessage> {
    const conversation = await this.get(conversationId);
    if (conversation.status !== "with_analyst" || conversation.analystId !== analyst.id) {
      throw new DomainError("forbidden", "Assuma o atendimento antes de responder.");
    }
    await this.save(conversation, conversation.status); // falha se a conversa foi devolvida ou encerrada nesse meio-tempo
    return this.messages.add({ conversationId, role: "analyst", authorName: analyst.name, text });
  }

  private async analystAction(conversationId: string, analyst: Employee, action: ConversationAction, note: string) {
    const conversation = await this.get(conversationId);
    // Conversa assumida por outro analista: só ele pode devolver ou encerrar.
    if (conversation.status === "with_analyst" && conversation.analystId !== analyst.id) {
      throw new DomainError("forbidden", "Outro analista está atendendo esta conversa.");
    }
    const status = nextStatus(conversation.status, action);
    const updated = await this.save(conversation, status, {
      analystId: action === "assume" ? analyst.id : action === "release" ? null : conversation.analystId,
      handoff: action === "release" ? null : conversation.handoff,
    });
    await this.messages.add({ conversationId, role: "system", text: note });
    return updated;
  }

  private async start(employeeId: string): Promise<Conversation> {
    const now = this.clock.now();
    const conversation: Conversation = {
      id: randomUUID(),
      employeeId,
      status: "with_agent",
      analystId: null,
      handoff: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.conversations.insert(conversation);
    return conversation;
  }

  /** Grava a mudança só se ninguém mexeu na conversa desde que ela foi lida. */
  private async save(conversation: Conversation, status: Conversation["status"], patch: Partial<Conversation> = {}) {
    const updated: Conversation = { ...conversation, ...patch, status, updatedAt: this.clock.now() };
    if (!(await this.conversations.update(updated, conversation.status))) {
      throw new DomainError("conflict", "A conversa acabou de mudar. Atualize e tente de novo.");
    }
    return updated;
  }
}
