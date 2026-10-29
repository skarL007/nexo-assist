/**
 * Porta de acesso do deploy público: só entra quem tem um link temporário
 * (`/?access=TOKEN`). O token é `<validade>.<assinatura>`: a validade em segundos
 * e um HMAC dela com o segredo ACCESS_TOKEN, que nunca sai do servidor.
 * O token vira um cookie httpOnly com a mesma validade, e o link fica limpo.
 * Sem ACCESS_TOKEN configurado, a porta fica aberta no desenvolvimento local e
 * fechada no deploy: esquecer a variável não pode deixar o modelo pago público.
 * Para abrir de propósito, PUBLIC_DEMO=1 (o teto DAILY_AGENT_TURN_LIMIT segura o custo).
 *
 * Lógica pura (sem Next) para poder ser testada; quem aplica é `src/proxy.ts`.
 * Os links são gerados por `npm run access-link` (scripts/access-link.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "nexo_access";
export const ACCESS_PARAM = "access";

export type AccessDecision =
  | { kind: "open" } // porta desligada
  | { kind: "allow" } // cookie dentro da validade
  | { kind: "grant"; expiresAt: Date } // link válido: grava o cookie até expiresAt e limpa a URL
  | { kind: "deny" };

/** Comparação em tempo constante: não deixa descobrir o token medindo o tempo de resposta. */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const sign = (secret: string, expiresAtSeconds: string) =>
  createHmac("sha256", secret).update(`nexo-access:${expiresAtSeconds}`).digest("base64url");

export function createAccessToken(secret: string, expiresAt: Date): string {
  const seconds = String(Math.floor(expiresAt.getTime() / 1000));
  return `${seconds}.${sign(secret, seconds)}`;
}

/** Validade do token, se a assinatura confere e ele ainda vale; senão, null. */
function validUntil(secret: string, token: string, now: Date): Date | null {
  const [seconds, signature, ...rest] = token.split(".");
  if (!seconds || !signature || rest.length || !/^\d+$/.test(seconds)) return null;
  if (!sameSecret(signature, sign(secret, seconds))) return null;
  const expiresAt = new Date(Number(seconds) * 1000);
  return expiresAt > now ? expiresAt : null;
}

export function decideAccess(input: {
  secret: string | undefined;
  tokenFromUrl: string | null;
  tokenFromCookie: string | undefined;
  now: Date;
  /** Rodando na Vercel (process.env.VERCEL). */
  deployed?: boolean;
  /** Demo pública ligada de propósito (PUBLIC_DEMO=1): abre sem link; o teto diário de mensagens continua valendo. */
  publicDemo?: boolean;
}): AccessDecision {
  const { secret, tokenFromUrl, tokenFromCookie, now, deployed = false, publicDemo = false } = input;
  if (publicDemo) return { kind: "open" };
  if (!secret) return deployed ? { kind: "deny" } : { kind: "open" };
  if (tokenFromUrl !== null) {
    const expiresAt = validUntil(secret, tokenFromUrl, now);
    return expiresAt ? { kind: "grant", expiresAt } : { kind: "deny" };
  }
  if (tokenFromCookie && validUntil(secret, tokenFromCookie, now)) return { kind: "allow" };
  return { kind: "deny" };
}
