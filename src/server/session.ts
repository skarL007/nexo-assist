/**
 * Sessão: um JWT assinado (HS256) num cookie httpOnly.
 * O login aceita qualquer senha para os funcionários do seed (regra do desafio);
 * o que importa é que o id do funcionário só sai daqui, nunca do corpo da requisição.
 */
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/config/env";
import { demoScopeOf } from "@/domain/demo";
import type { Employee, EmployeeRole } from "@/domain/employee";
import { createServices } from "@/infrastructure/container";
import { HttpError } from "./http";

const COOKIE = "nexo_session";
const SESSION_SECONDS = 8 * 60 * 60;
const REMEMBER_SECONDS = 7 * 24 * 60 * 60;

const secret = () => new TextEncoder().encode(env().AUTH_SECRET);

/** Sem "Manter conectado", o cookie some quando o navegador fecha e o token vence em 8 horas. */
export async function startSession(employee: Employee, remember = false) {
  const lifetime = remember ? REMEMBER_SECONDS : SESSION_SECONDS;
  const token = await new SignJWT({ role: employee.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(employee.id)
    .setIssuedAt()
    .setExpirationTime(`${lifetime}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: lifetime } : {}),
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Funcionário logado, ou null. Relê do banco para refletir mudanças. */
export async function currentUser(): Promise<Employee | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const employee = payload.sub ? await createServices().employees.findById(payload.sub) : null;
    // Sessão emitida antes da última troca de senha deixa de valer.
    if (!employee || (payload.iat ?? 0) * 1000 < employee.passwordChangedAt.getTime()) return null;
    if (env().PUBLIC_DEMO === "1" && !demoScopeOf(employee.id)) return null;
    return employee;
  } catch {
    return null;
  }
}

export async function requireUser(role: EmployeeRole): Promise<Employee> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Faça login para continuar.");
  if (user.role !== role) throw new HttpError(403, "Você não tem acesso a esta área.");
  return user;
}

export const homeFor = (role: EmployeeRole) => (role === "analyst" ? "/console" : "/atendimento");

/** Para páginas: sem sessão vai para o login; papel errado vai para a sua área. */
export async function requirePageUser(role: EmployeeRole): Promise<Employee> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}
