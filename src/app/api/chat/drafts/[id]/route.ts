import { draftActionSchema } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { handle, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { conversationView } from "@/server/views";

/** POST /api/chat/drafts/:id { action: "confirm" | "cancel" } — botões do rascunho. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const employee = await requireUser("employee");
  const { action } = await parseBody(request, draftActionSchema);
  const draftId = Number((await params).id);
  const services = createServices();

  if (action === "confirm") await services.drafts.confirmFromButton(draftId, employee.id);
  else await services.drafts.cancelFromButton(draftId, employee.id);

  return Response.json(await conversationView(services, await services.conversations.findOpen(employee.id)));
});
