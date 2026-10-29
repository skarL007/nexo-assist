import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import type { Employee } from "@/domain/employee";
import { db } from "@/infrastructure/db/client";
import { employees } from "@/infrastructure/db/schema";
import { eq } from "drizzle-orm";
import { DEMO_LIFETIME_SECONDS, provisionDemoWorkspace } from "@/infrastructure/demo-workspace";
import { HttpError } from "./http";

const COOKIE = "nexo_demo_workspace";
const AUDIENCE = "nexo-demo-workspace";
const key = () => new TextEncoder().encode(env().AUTH_SECRET);

/** O navegador só transporta um espaço assinado pelo servidor; não escolhe um namespace. */
export async function publicDemoEmployee(template: Employee): Promise<Employee> {
  if (env().PUBLIC_DEMO !== "1") return template;
  if (template.id.startsWith("demo:")) throw new HttpError(401, "Use um dos funcionários de exemplo.");
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  let scope: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], audience: AUDIENCE });
      if (payload.sub && /^[0-9a-f-]{36}$/.test(payload.sub)) scope = payload.sub;
    } catch {
      // Cookie vencido ou alterado recebe um espaço novo.
    }
  }
  const newWorkspace = !scope;
  scope ??= randomUUID();
  await provisionDemoWorkspace(db(), scope);
  if (newWorkspace) {
    const signed = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" }).setSubject(scope).setAudience(AUDIENCE)
      .setIssuedAt().setExpirationTime(`${DEMO_LIFETIME_SECONDS}s`).sign(key());
    jar.set(COOKIE, signed, { httpOnly: true, sameSite: "lax", secure: env().NODE_ENV === "production", path: "/", maxAge: DEMO_LIFETIME_SECONDS });
  }
  const person = await db().query.employees.findFirst({ where: eq(employees.id, `demo:${scope}:${template.id}`) });
  if (!person) throw new HttpError(401, "Funcionário de demonstração não encontrado.");
  return person;
}
