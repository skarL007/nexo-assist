import { handle } from "@/server/http";
import { endSession } from "@/server/session";

export const POST = handle(async () => {
  await endSession();
  return Response.json({ redirectTo: "/login" });
});
