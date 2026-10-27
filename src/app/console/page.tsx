import { ConsoleScreen } from "@/features/console/components/console-screen";
import { requirePageUser } from "@/server/session";
import { StoreProvider } from "@/store/store-provider";

export default async function ConsolePage() {
  const analyst = await requirePageUser("analyst");
  return (
    <StoreProvider>
      <ConsoleScreen analyst={{ id: analyst.id, name: analyst.name }} />
    </StoreProvider>
  );
}
