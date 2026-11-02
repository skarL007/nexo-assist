import { env } from "@/config/env";
import { loginSchema } from "@/contracts/chat";
import { createServices } from "@/infrastructure/container";
import { demoLoginEnabled } from "@/server/auth-mode";
import { handle, HttpError, parseBody } from "@/server/http";
import { homeFor, startSession } from "@/server/session";
import { publicDemoEmployee } from "@/server/demo-session";

/** Login de demonstração: a senha não é conferida (regra do desafio). Fora da demo, entra-se pelo SSO. */
export const POST = handle(async (request: Request) => {
  if (!demoLoginEnabled(env())) throw new HttpError(404, "Login por e-mail desligado neste ambiente. Entre pelo SSO.");
  const { email, remember } = await parseBody(request, loginSchema);
  const employee = await createServices().employees.findByEmail(email);
  if (!employee) throw new HttpError(401, "E-mail não encontrado. Use um dos funcionários de exemplo.");

  await startSession(await publicDemoEmployee(employee), remember);
  return Response.json({ redirectTo: homeFor(employee.role) });
});
