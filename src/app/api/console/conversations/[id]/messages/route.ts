import { analystMessageSchema } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { handle, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { consoleDetail } from "@/server/views";

/** POST /api/console/conversations/:id/messages { text, suggested? } — analista responde. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const analyst = await requireUser("analyst");
  const { text, suggested } = await parseBody(request, analystMessageSchema);
  const { id } = await params;
  const services = createServices();

  await services.conversations.postAnalystMessage(id, analyst, text);
  if (suggested) await services.replySuggestions.recordSent(id, analyst, suggested, text);
  return Response.json(await consoleDetail(services, await services.conversations.get(id)));
});
