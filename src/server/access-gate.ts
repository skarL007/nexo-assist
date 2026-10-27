/**
 * Porta de acesso do deploy público: só entra quem tem o link com o token
 * (`/?access=TOKEN`). O token vira um cookie httpOnly e o link fica limpo.
 * Sem ACCESS_TOKEN configurado (ex.: desenvolvimento local), a porta fica aberta.
 *
 * Lógica pura (sem Next) para poder ser testada; quem aplica é `src/proxy.ts`.
 */
import { timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "nexo_access";
export const ACCESS_PARAM = "access";

export type AccessDecision =
  | { kind: "open" } // porta desligada
  | { kind: "allow" } // cookie válido
  | { kind: "grant" } // token válido na URL: grava o cookie e limpa a URL
  | { kind: "deny" };

/** Comparação em tempo constante: não deixa descobrir o token medindo o tempo de resposta. */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function decideAccess(input: {
  expectedToken: string | undefined;
  tokenFromUrl: string | null;
  tokenFromCookie: string | undefined;
}): AccessDecision {
  const { expectedToken, tokenFromUrl, tokenFromCookie } = input;
  if (!expectedToken) return { kind: "open" };
  if (tokenFromUrl !== null) return sameSecret(tokenFromUrl, expectedToken) ? { kind: "grant" } : { kind: "deny" };
  if (tokenFromCookie && sameSecret(tokenFromCookie, expectedToken)) return { kind: "allow" };
  return { kind: "deny" };
}
