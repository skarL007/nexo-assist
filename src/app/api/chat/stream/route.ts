import { servicesFor } from "@/server/services";
import { handle } from "@/server/http";
import { liveStream } from "@/server/live-stream";
import { requireUser } from "@/server/session";

export const maxDuration = 60; // segundos (limite da função na Vercel); o stream fecha antes

/** GET /api/chat/stream → SSE: "change" quando a conversa do funcionário logado muda (ex.: o analista respondeu). */
export const GET = handle(async (request: Request) => {
  const employee = await requireUser("employee");
  const { changes } = servicesFor(employee);
  return liveStream(request, () => changes.employeeVersion(employee.id));
});
