import { createServices } from "@/infrastructure/container";
import { handle } from "@/server/http";
import { liveStream } from "@/server/live-stream";
import { requireUser } from "@/server/session";

export const maxDuration = 60; // segundos (limite da função na Vercel); o stream fecha antes

/** GET /api/console/stream → SSE: "change" quando algo do console muda (a tela busca de novo). */
export const GET = handle(async (request: Request) => {
  await requireUser("analyst");
  const { changes } = createServices();
  return liveStream(request, () => changes.consoleVersion());
});
