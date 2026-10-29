import { servicesFor } from "@/server/services";
import { handle, logError } from "@/server/http";
import { requireUser } from "@/server/session";
import { slaAlerts } from "@/server/views";

/**
 * GET /api/chat/sla → chamados do funcionário com prazo vencido ou em risco, com o porquê.
 * Separado da conversa: se o sistema de chamados cair, o chat abre igual e só o aviso não aparece.
 */
export const GET = handle(async () => {
  const employee = await requireUser("employee");
  const services = servicesFor(employee);
  const tickets = await services.tickets.listMine(employee.id, { openOnly: true }).catch((error: unknown) => {
    logError(error);
    return [];
  });
  return Response.json({ alerts: slaAlerts(tickets.map((t) => services.tickets.snapshot(t)), new Date()) });
});
