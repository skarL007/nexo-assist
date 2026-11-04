/**
 * Prepara a imagem no navegador antes de enviar: reduz para no máximo 1600 px no lado maior
 * e reencoda em JPEG (foto de celular chega com 3–5 MB; o servidor aceita até 1 MB).
 * O servidor confere de novo o formato pelos bytes: aqui é só para caber e ir rápido.
 */
import type { PendingImage } from "./chat-slice";

const MAX_SIDE = 1600;
const MAX_BYTES = 1_000_000;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export const IMAGE_ACCEPT = ACCEPTED.join(",");

export async function prepareImage(file: File): Promise<PendingImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Envie uma imagem PNG, JPEG ou WebP.");
  const bitmap = await createImageBitmap(file);
  try {
    for (const [side, quality] of [[MAX_SIDE, 0.88], [MAX_SIDE, 0.75], [1280, 0.7]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { mime: "image/jpeg", data: btoa(binary), previewUrl: URL.createObjectURL(blob) };
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("A imagem ficou grande demais. Recorte só a parte do problema e tente de novo.");
}
