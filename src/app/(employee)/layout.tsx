import { EmployeeSidebar } from "@/features/shell/employee-sidebar";
import { requirePageUser } from "@/server/session";
import { StoreProvider } from "@/store/store-provider";

/** Área do funcionário: só entra quem tem sessão de funcionário. */
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const employee = await requirePageUser("employee");
  return (
    <div className="flex h-screen">
      <EmployeeSidebar name={employee.name} email={employee.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StoreProvider>{children}</StoreProvider>
      </div>
    </div>
  );
}
