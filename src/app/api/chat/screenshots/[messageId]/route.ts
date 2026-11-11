/**
 * GET /api/chat/screenshots/:messageId → a imagem anexada à mensagem, só para a dona da conversa
 * e para os analistas (no espaço da demo, só o mesmo visitante). Para os demais, 404.
 */
import { servicesFor } from "@/server/services";
import { handle, HttpError } from "@/server/http";
import { currentUser } from "@/server/session";

export const GET = handle(async (_request: Request, { params }: { params: Promise<{ messageId: string }> }) => {
  const viewer = await currentUser();
  if (!viewer) throw new HttpError(401, "Faça login para continuar.");
  const { messageId } = await params;
  const image = await servicesFor(viewer).screenshots.forViewer(messageId.slice(0, 100), viewer);
  return new Response(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      // Dado do funcionário: o navegador pode guardar, mas confere a sessão a cada uso (no mesmo computador,
      // depois de sair ou trocar de usuário, a imagem não sai do cache). O tipo vem dos bytes conferidos.
      "Cache-Control": "private, no-cache",
      // Aberta direto na aba, a resposta não executa nem carrega nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});
