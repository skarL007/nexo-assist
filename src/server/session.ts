/**
 * Sessão: um JWT assinado (HS256) num cookie httpOnly.
 * O login aceita qualquer senha para os funcionários do seed (regra do desafio);
 * o que importa é que o id do funcionário só sai daqui, nunca do corpo da requisição.
 */
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import type { Employee, EmployeeRole } from "@/domain/employee";
import { createServices } from "@/infrastructure/container";
import { HttpError } from "./http";

const COOKIE = "nexo_session";
const MAX_AGE_SECONDS = 8 * 60 * 60;

const secret = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function startSession(employee: Employee) {
  const token = await new SignJWT({ role: employee.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(employee.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
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
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ? await createServices().employees.findById(payload.sub) : null;
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
