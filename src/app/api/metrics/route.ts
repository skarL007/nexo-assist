import { env } from "@/config/env";
import { metricsAuthorized, processMetrics } from "@/infrastructure/telemetry/prometheus";

export const dynamic = "force-dynamic";

/**
 * GET /api/metrics → métricas no formato do Prometheus (texto). Protegida por METRICS_TOKEN
 * (Authorization: Bearer); sem o token configurado, a rota não existe.
 */
export async function GET(request: Request) {
  const access = metricsAuthorized(request.headers.get("authorization"), env().METRICS_TOKEN);
  if (access === "disabled") return new Response("Not found", { status: 404 });
  if (access === "denied") return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  const registry = processMetrics().registry;
  return new Response(await registry.metrics(), { headers: { "Content-Type": registry.contentType, "Cache-Control": "no-store" } });
}
