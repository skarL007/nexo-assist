/**
 * Quando o login de demonstração (só o e-mail de um funcionário do seed, qualquer senha) fica ligado.
 * Ele é a regra do desafio, não autenticação: conhecer o e-mail basta para entrar. Por isso,
 * com SSO configurado ele desliga sozinho, e só volta com DEMO_LOGIN=1 explícito (o E2E usa
 * os dois). Sem imports do Next, para testar a política sem servidor.
 */
import { oidcConfig } from "./oidc";

type AuthEnv = Parameters<typeof oidcConfig>[0] & { DEMO_LOGIN?: "0" | "1" };

export function demoLoginEnabled(env: AuthEnv): boolean {
  if (env.DEMO_LOGIN) return env.DEMO_LOGIN === "1";
  return oidcConfig(env) === null;
}
