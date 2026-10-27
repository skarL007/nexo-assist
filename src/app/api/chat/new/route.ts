import { createServices } from "@/infrastructure/container";
import { handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { conversationView } from "@/server/views";

/** POST /api/chat/new → encerra a conversa atual e começa uma sessão limpa. */
export const POST = handle(async () => {
  const employee = await requireUser("employee");
  const services = createServices();
  await services.conversations.closeOpen(employee.id);
  return Response.json(await conversationView(services, null));
});
