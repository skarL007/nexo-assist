/**
 * Imagem anexada pelo funcionário (captura de tela ou foto do equipamento): aceita pelas regras
 * do domínio, guardada à parte, lida pelo modelo de visão e servida só a quem vê a conversa.
 * O agent nunca recebe a imagem, só a descrição gravada aqui.
 */
import type { Employee } from "@/domain/employee";
import { DomainError } from "@/domain/errors";
import { assertScreenshotQuota, checkScreenshot, SCREENSHOTS_PER_EMPLOYEE_PER_DAY, type ScreenshotMime } from "@/domain/screenshot";
import type { ConversationService } from "./conversation-service";
import type { BudgetRepository, Clock, ImageDescriber, MessageRepository, ScreenshotStore } from "./ports";
import type { SpendLedger } from "./spend-ledger";

/** Corte da descrição: o modelo foi pedido para 5 linhas; isto protege o histórico e o custo. */
const DESCRIPTION_MAX_CHARS = 800;
/** Leitura que falhou (timeout, erro do provedor) pode ter sido cobrada: entra no livro-caixa pelo dobro do custo típico. */
const FAILED_READ_ESTIMATE_USD = 0.0002;

export interface ScreenshotRead {
  status: "read" | "failed";
  description: string | null;
  /** Modelo de visão usado; null quando a leitura está desligada. */
  model: string | null;
  latencyMs: number;
  /** Motivo em texto fixo: vai para o passo do agent, que o funcionário e o analista leem. */
  error?: string;
  /** Mensagem crua do provedor, só para o registro do servidor. Nunca vai para a conversa. */
  cause?: string;
}

export class ScreenshotService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationService,
    private readonly store: ScreenshotStore,
    private readonly describer: ImageDescriber | null,
    private readonly spend: SpendLedger,
    private readonly budget: BudgetRepository,
    private readonly limits: { dailyTotal: number },
    private readonly clock: Clock,
  ) {}

  /**
   * Confere formato, tamanho e os três limites antes de gravar qualquer coisa: por conversa,
   * por pessoa no dia e o total do dia. Os dois últimos são contadores atômicos: sem eles,
   * abrir conversas novas na demo pública encheria o banco de imagens.
   */
  async accept(conversationId: string, employeeId: string, image: { mime: string; bytes: Uint8Array }): Promise<ScreenshotMime> {
    const mime = checkScreenshot(image.bytes, image.mime);
    assertScreenshotQuota(await this.messages.countScreenshots(conversationId));

    const day = this.clock.now().toISOString().slice(0, 10);
    const personKey = `screenshots:${employeeId}:${day}`;
    if (!(await this.budget.reserve(personKey, SCREENSHOTS_PER_EMPLOYEE_PER_DAY))) {
      throw new DomainError("message_limit", `Você já enviou ${SCREENSHOTS_PER_EMPLOYEE_PER_DAY} imagens hoje. Descreva o erro por texto.`);
    }
    if (!(await this.budget.reserve(`screenshots:${day}`, this.limits.dailyTotal))) {
      await this.budget.release(personKey); // a imagem não foi aceita: a vaga da pessoa volta
      throw new DomainError("daily_limit", "O limite de imagens de hoje foi atingido. Descreva o erro por texto.");
    }
    return mime;
  }

  async save(messageId: string, mime: ScreenshotMime, bytes: Uint8Array): Promise<void> {
    await this.store.put(messageId, mime, bytes);
  }

  /** Pede a descrição ao modelo de visão. Nunca lança: a falha vira status "failed" e o turno segue. */
  async read(messageId: string, mime: ScreenshotMime, bytes: Uint8Array): Promise<ScreenshotRead> {
    const startedAt = Date.now();
    const finish = async (read: Omit<ScreenshotRead, "latencyMs">): Promise<ScreenshotRead> => {
      await this.messages.updateScreenshot(messageId, { mime, status: read.status, description: read.description });
      return { ...read, latencyMs: Date.now() - startedAt };
    };
    if (!this.describer) return finish({ status: "failed", description: null, model: null, error: "leitura de imagem desligada (VISION_MODEL=off)" });

    const model = this.describer.model;
    try {
      const { text, costUsd } = await this.describer.describe(mime, bytes);
      await this.spend.record(costUsd);
      const description = text.trim().slice(0, DESCRIPTION_MAX_CHARS);
      if (!description) return finish({ status: "failed", description: null, model, error: "o modelo devolveu descrição vazia" });
      return finish({ status: "read", description, model });
    } catch (error) {
      await this.spend.record(FAILED_READ_ESTIMATE_USD);
      return finish({
        status: "failed",
        description: null,
        model,
        error: "o modelo de visão não respondeu",
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** A imagem, só para quem vê a conversa: a dona dela ou um analista (no mesmo espaço da demo). */
  async forViewer(messageId: string, viewer: Employee): Promise<{ mime: ScreenshotMime; bytes: Uint8Array }> {
    const notFound = new DomainError("not_found", "Imagem não encontrada.");
    const message = await this.messages.findById(messageId);
    if (!message?.screenshot) throw notFound;
    try {
      if (viewer.role === "analyst") await this.conversations.get(message.conversationId);
      else await this.conversations.getForEmployee(viewer.id, message.conversationId);
    } catch {
      throw notFound;
    }
    const image = await this.store.get(messageId);
    if (!image) throw notFound;
    return image;
  }
}
