import { servicesFor } from "@/server/services";
import { handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { conversationView } from "@/server/views";

/** POST /api/chat/new → encerra a conversa atual e começa uma sessão limpa. */
export const POST = handle(async () => {
  const employee = await requireUser("employee");
  const services = servicesFor(employee);
  const closed = await services.conversations.closeOpen(employee.id);
  if (closed) await services.drafts.cancelPending(closed.id);
  return Response.json(await conversationView(services, null));
});
