/**
 * Sugestão de resposta para o analista: o modelo escreve um rascunho a partir do relatório
 * da conversa e das últimas mensagens; o analista revisa, edita e envia (nada sai sozinho).
 *
 * Regras em código: só quem assumiu a conversa pede; o pedido passa pelos mesmos tetos do chat
 * (turnos e gasto em dólares) e o custo entra no mesmo livro-caixa; número de chamado que não
 * está no contexto vira aviso; o uso fica registrado (enviada igual × editada) para medir se
 * as sugestões servem.
 */
import type { Employee } from "@/domain/employee";
import { DomainError } from "@/domain/errors";
import { suggestionOutcome, unknownTicketCodes } from "@/domain/reply-suggestion";
import type { ConversationService } from "./conversation-service";
import { systemClock, type BudgetRepository, type Clock, type ReplyWriter, type SuggestionRepository } from "./ports";
import type { SpendLedger } from "./spend-ledger";

/** Livro-caixa do gasto com IA e o preço por token do modelo que escreve a sugestão (null = preço desconhecido). */
export interface SuggestionCost {
  ledger: SpendLedger;
  price: { input: number; output: number } | null;
}

export interface Suggestion {
  text: string;
  warnings: string[];
}

export class ReplySuggestionService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly budget: BudgetRepository,
    private readonly writer: ReplyWriter | null,
    private readonly suggestions: SuggestionRepository,
    private readonly totalLimit: number | undefined,
    private readonly cost: SuggestionCost | null = null,
    private readonly clock: Clock = systemClock,
  ) {}

  async suggest(conversationId: string, analyst: Employee, context: string): Promise<Suggestion> {
    await this.assertHandledBy(conversationId, analyst);
    if (!this.writer) throw new DomainError("agent_unavailable", "A sugestão de resposta não está disponível neste ambiente.");
    // Teto de gasto em dólares antes do de turnos, como no chat: recusado aqui, nenhuma vaga é gasta.
    await this.cost?.ledger.assertCanSpend();
    if (this.totalLimit !== undefined && !(await this.budget.reserve("model_turns", this.totalLimit))) {
      throw new DomainError("daily_limit", "O limite de uso do modelo desta demonstração foi atingido.");
    }

    const { text, usage } = await this.writer.write({ context, analystFirstName: analyst.name.split(" ")[0] });
    const price = this.cost?.price;
    if (price && usage) await this.cost?.ledger.record(usage.inputTokens * price.input + usage.outputTokens * price.output);
    await this.suggestions.record({ conversationId, analystId: analyst.id, outcome: "generated", at: this.clock.now() });
    return {
      text,
      warnings: unknownTicketCodes(text, context).map((code) => `Cita o ${code}, que não aparece na conversa: confira antes de enviar.`),
    };
  }

  async recordSent(conversationId: string, analyst: Employee, suggested: string, sent: string): Promise<void> {
    await this.suggestions.record({ conversationId, analystId: analyst.id, outcome: suggestionOutcome(suggested, sent), at: this.clock.now() });
  }

  private async assertHandledBy(conversationId: string, analyst: Employee) {
    const conversation = await this.conversations.get(conversationId);
    if (conversation.status !== "with_analyst" || conversation.analystId !== analyst.id) {
      throw new DomainError("forbidden", "Assuma o atendimento antes de pedir uma sugestão.");
    }
  }
}
