import type { KnownIssueView } from "@/contracts/chat";
import { CATEGORY_LABEL } from "@/domain/ticket";
import { servicesFor } from "@/server/services";
import { handle } from "@/server/http";
import { requireUser } from "@/server/session";

/** GET /api/console/known-issues → possíveis incidentes em massa agora (sem quem relatou nem os números). */
export const GET = handle(async () => {
  const analyst = await requireUser("analyst");
  const issues = await servicesFor(analyst).tickets.knownIssues();
  return Response.json(
    issues.map((issue): KnownIssueView => ({ category: CATEGORY_LABEL[issue.category], terms: issue.terms, reports: issue.reports, people: issue.people, since: issue.since.toISOString() })),
  );
});
