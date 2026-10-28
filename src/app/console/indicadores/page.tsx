import { InsightsScreen } from "@/features/console/components/insights-screen";
import { createServices } from "@/infrastructure/container";
import { requirePageUser } from "@/server/session";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function InsightsPage() {
  const analyst = await requirePageUser("analyst");
  const insights = await createServices().insights.lastDays(WINDOW_DAYS);
  return <InsightsScreen analystName={analyst.name} insights={insights} days={WINDOW_DAYS} generatedAt={new Date().toISOString()} />;
}
