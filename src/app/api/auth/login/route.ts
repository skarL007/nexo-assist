import { loginSchema } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { handle, HttpError, parseBody } from "@/server/http";
import { homeFor, startSession } from "@/server/session";

export const POST = handle(async (request: Request) => {
  const { email, remember } = await parseBody(request, loginSchema);
  const employee = await createServices().employees.findByEmail(email);
  if (!employee) throw new HttpError(401, "E-mail não encontrado. Use um dos funcionários de exemplo.");

  await startSession(employee, remember);
  return Response.json({ redirectTo: homeFor(employee.role) });
});
