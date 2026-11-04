/**
 * Imagem anexada pelo funcionário (captura de tela ou foto do equipamento): aceita pelas regras
 * do domínio, guardada à parte, lida pelo modelo de visão e servida só a quem vê a conversa.
 * O agent nunca recebe a imagem, só a descrição gravada aqui.
 */
import type { Employee } from "@/domain/employee";
import { DomainError } from "@/domain/errors";
import { assertScreenshotQuota, checkScreenshot, type ScreenshotMime } from "@/domain/screenshot";
import type { ConversationService } from "./conversation-service";
import type { ImageDescriber, MessageRepository, ScreenshotStore } from "./ports";
import type { SpendLedger } from "./spend-ledger";

/** Corte da descrição: o modelo foi pedido para 5 linhas; isto protege o histórico e o custo. */
const DESCRIPTION_MAX_CHARS = 800;

export interface ScreenshotRead {
  status: "read" | "failed";
  description: string | null;
  /** Modelo de visão usado; null quando a leitura está desligada. */
  model: string | null;
  latencyMs: number;
  error?: string;
}

export class ScreenshotService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationService,
    private readonly store: ScreenshotStore,
    private readonly describer: ImageDescriber | null,
    private readonly spend: SpendLedger,
  ) {}

  /** Confere formato, tamanho e o limite da conversa antes de gravar qualquer coisa. */
  async accept(conversationId: string, image: { mime: string; bytes: Uint8Array }): Promise<ScreenshotMime> {
    const mime = checkScreenshot(image.bytes, image.mime);
    assertScreenshotQuota(await this.messages.countScreenshots(conversationId));
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
      return finish({ status: "failed", description: null, model, error: error instanceof Error ? error.message : String(error) });
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
