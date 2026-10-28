import type { SuggestionView } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { suggestionContext } from "@/lib/report-text";
import { handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { consoleDetail } from "@/server/views";

export const maxDuration = 30;

/** POST /api/console/conversations/:id/suggestion — rascunho de resposta para o analista revisar. */
export const POST = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const analyst = await requireUser("analyst");
  const { id } = await params;
  const services = createServices();
  const detail = await consoleDetail(services, await services.conversations.get(id));
  const suggestion: SuggestionView = await services.replySuggestions.suggest(id, analyst, suggestionContext(detail));
  return Response.json(suggestion);
});
