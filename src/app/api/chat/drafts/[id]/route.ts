import { z } from "zod";
import { draftActionSchema } from "@/contracts/chat";
import { servicesFor } from "@/server/services";
import { handle, HttpError, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { conversationView } from "@/server/views";

/** POST /api/chat/drafts/:id { action: "confirm" | "cancel" } ou { action: "edit", fields } — botões do rascunho. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const employee = await requireUser("employee");
  const body = await parseBody(request, draftActionSchema);
  const parsedId = z.coerce.number().int().positive().safeParse((await params).id);
  if (!parsedId.success) throw new HttpError(400, "Rascunho inválido.");
  const draftId = parsedId.data;
  const services = servicesFor(employee);

  if (body.action === "confirm") await services.drafts.confirmFromButton(draftId, employee.id);
  else if (body.action === "cancel") await services.drafts.cancelFromButton(draftId, employee.id);
  else await services.drafts.reviseFromForm(draftId, employee.id, body.fields);

  return Response.json(await conversationView(services, await services.conversations.findOpen(employee.id)));
});
