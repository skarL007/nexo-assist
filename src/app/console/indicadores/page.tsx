import { InsightsScreen } from "@/features/console/components/insights-screen";
import { servicesFor } from "@/server/services";
import { requirePageUser } from "@/server/session";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function InsightsPage() {
  const analyst = await requirePageUser("analyst");
  const services = servicesFor(analyst);
  const [insights, slaQueue] = await Promise.all([services.insights.lastDays(WINDOW_DAYS), services.insights.slaQueue()]);
  return <InsightsScreen analystName={analyst.name} insights={insights} slaQueue={slaQueue} days={WINDOW_DAYS} generatedAt={new Date().toISOString()} />;
}
