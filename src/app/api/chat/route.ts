/**
 * GET  /api/chat → conversa aberta do funcionário logado
 * POST /api/chat → envia uma mensagem; a resposta é um stream NDJSON de eventos
 */
import { runAgentTurn } from "@/agent/run-turn";
import { sendMessageSchema, type ChatStreamEvent } from "@/contracts/chat";
import { DomainError } from "@/domain/errors";
import { createServices } from "@/infrastructure/container";
import { handle, logError, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { conversationView } from "@/server/views";

export const maxDuration = 60; // segundos (limite da função na Vercel)

export const GET = handle(async () => {
  const employee = await requireUser("employee");
  const services = createServices();
  return Response.json(await conversationView(services, await services.conversations.findOpen(employee.id)));
});

export const POST = handle(async (request: Request) => {
  const employee = await requireUser("employee");
  const { text } = await parseBody(request, sendMessageSchema);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        // Se o funcionário fechar a aba, o sinal cancela a chamada ao modelo (não gasta à toa).
        for await (const event of runAgentTurn(employee, text, request.signal)) send(event);
      } catch (error) {
        if (!(error instanceof DomainError)) logError(error);
        send({
          type: "error",
          message: error instanceof DomainError ? error.message : "Não consegui responder agora. Tente de novo em instantes.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
