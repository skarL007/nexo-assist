import { consoleActionSchema } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { handle, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { consoleDetail } from "@/server/views";

type Context = { params: Promise<{ id: string }> };

/** GET /api/console/conversations/:id → histórico + chamados do funcionário. */
export const GET = handle(async (_request: Request, { params }: Context) => {
  await requireUser("analyst");
  const services = createServices();
  return Response.json(await consoleDetail(services, await services.conversations.get((await params).id)));
});

/** POST /api/console/conversations/:id { action: "assume" | "release" | "close" } */
export const POST = handle(async (request: Request, { params }: Context) => {
  const analyst = await requireUser("analyst");
  const { action } = await parseBody(request, consoleActionSchema);
  const { id } = await params;
  const services = createServices();

  const conversation = await services.conversations[action](id, analyst);
  return Response.json(await consoleDetail(services, conversation));
});
