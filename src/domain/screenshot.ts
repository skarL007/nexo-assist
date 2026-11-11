/**
 * Captura de tela anexada pelo funcionário: o que é aceito (formato pelos primeiros bytes,
 * tamanho e quantas por conversa). Regras em código; o modelo de visão só descreve.
 */
import { DomainError } from "./errors";

export const SCREENSHOT_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ScreenshotMime = (typeof SCREENSHOT_MIMES)[number];

/** Depois de decodificado (o navegador já reduz para 1600 px antes de enviar). */
export const SCREENSHOT_MAX_BYTES = 1_000_000;
export const SCREENSHOTS_PER_CONVERSATION = 5;
/** Somando todas as conversas: "comece uma nova conversa" não zera esta conta. */
export const SCREENSHOTS_PER_EMPLOYEE_PER_DAY = 10;
/** Mensagem só com imagem: o histórico mostra este texto ao lado da miniatura. */
export const IMAGE_ONLY_TEXT = "Enviei uma imagem.";

/** O que fica gravado com a mensagem: a imagem fica à parte, servida só a quem vê a conversa. */
export interface ScreenshotInfo {
  mime: ScreenshotMime;
  /** pending: ainda não lida (ou um analista atendia e viu a imagem); read: descrita; failed: a leitura falhou. */
  status: "pending" | "read" | "failed";
  /** Descrição do modelo de visão (só com status read). */
  description: string | null;
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, i) => bytes[offset + i] === byte);

export function detectImageMime(bytes: Uint8Array): ScreenshotMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function checkScreenshot(bytes: Uint8Array, declared: string): ScreenshotMime {
  const mime = detectImageMime(bytes);
  if (!mime || mime !== declared) throw new DomainError("invalid_input", "A captura precisa ser uma imagem PNG, JPEG ou WebP.");
  if (bytes.length > SCREENSHOT_MAX_BYTES) throw new DomainError("invalid_input", "A captura passou de 1 MB. Recorte só a parte com o erro e tente de novo.");
  return mime;
}

export function assertScreenshotQuota(alreadySent: number): void {
  if (alreadySent >= SCREENSHOTS_PER_CONVERSATION) {
    throw new DomainError("message_limit", `Esta conversa já tem ${SCREENSHOTS_PER_CONVERSATION} capturas. Descreva o erro por texto ou comece uma nova conversa.`);
  }
}
