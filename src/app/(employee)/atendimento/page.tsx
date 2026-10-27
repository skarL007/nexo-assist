import { firstName } from "@/domain/employee";
import { ChatScreen } from "@/features/chat/components/chat-screen";
import { requirePageUser } from "@/server/session";

export default async function AttendancePage() {
  const employee = await requirePageUser("employee");
  return <ChatScreen firstName={firstName(employee.name)} />;
}
