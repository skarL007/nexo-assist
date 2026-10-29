import { servicesFor } from "@/server/services";
import { handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { consoleList } from "@/server/views";

/** GET /api/console/conversations → as conversas mais recentes (até 200). */
export const GET = handle(async () => {
  const analyst = await requireUser("analyst");
  const services = servicesFor(analyst);
  return Response.json(await consoleList(services, await services.conversations.listRecent()));
});
