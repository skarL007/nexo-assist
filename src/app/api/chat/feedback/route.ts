import { feedbackSchema } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { handle, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";

/** POST /api/chat/feedback { messageId, helpful } — "Isso resolveu?" numa resposta do agent. */
export const POST = handle(async (request: Request) => {
  const employee = await requireUser("employee");
  const { messageId, helpful } = await parseBody(request, feedbackSchema);
  await createServices().feedback.rate(employee.id, messageId, helpful);
  return Response.json({ ok: true });
});
