/**
 * "Isso resolveu?": o funcionário avalia uma resposta do agent. A avaliação alimenta
 * os indicadores do console e mostra ao analista o que não funcionou.
 */
import { DomainError } from "@/domain/errors";
import type { Clock, ConversationRepository, FeedbackRepository, MessageRepository } from "./ports";
import { systemClock } from "./ports";

export class FeedbackService {
  constructor(
    private readonly feedback: FeedbackRepository,
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async rate(employeeId: string, messageId: string, helpful: boolean): Promise<void> {
    const message = await this.messages.findById(messageId);
    const conversation = message ? await this.conversations.findById(message.conversationId) : null;
    // Mensagem de outra pessoa responde igual a uma que não existe: não confirma que ela existe.
    if (!message || message.role !== "agent" || conversation?.employeeId !== employeeId) {
      throw new DomainError("not_found", "Resposta não encontrada.");
    }
    await this.feedback.upsert({ messageId, employeeId, helpful, at: this.clock.now() });
  }

  byConversation(conversationId: string): Promise<Record<string, boolean>> {
    return this.feedback.byConversation(conversationId);
  }
}
