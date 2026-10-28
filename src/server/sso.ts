/**
 * Cola do SSO com o Next: guarda state, nonce e o verifier do PKCE num cookie
 * assinado (HS256 com o AUTH_SECRET) entre a ida ao provedor e a volta.
 */
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import { discover, oidcConfig, type OidcConfig, type OidcProvider } from "./oidc";

const COOKIE = "nexo_sso";
const TRANSACTION_SECONDS = 10 * 60;
const PROVIDER_CACHE_MS = 60 * 60 * 1000;

export interface SsoTransaction {
  state: string;
  nonce: string;
  verifier: string;
}

const secret = () => new TextEncoder().encode(env().AUTH_SECRET);

export function ssoConfig(): OidcConfig | null {
  return oidcConfig(env());
}

let cachedProvider: { issuer: string; provider: OidcProvider; at: number } | null = null;

export async function ssoProvider(config: OidcConfig): Promise<OidcProvider> {
  if (cachedProvider && cachedProvider.issuer === config.issuer && Date.now() - cachedProvider.at < PROVIDER_CACHE_MS) return cachedProvider.provider;
  const provider = await discover(config.issuer);
  cachedProvider = { issuer: config.issuer, provider, at: Date.now() };
  return provider;
}

export function callbackUrl(request: Request): string {
  return new URL("/api/auth/sso/callback", request.url).toString();
}

export async function saveTransaction(transaction: SsoTransaction) {
  const token = await new SignJWT({ ...transaction }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${TRANSACTION_SECONDS}s`).sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    // lax: o cookie precisa voltar no redirect do provedor (navegação de outro site).
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/api/auth/sso",
    maxAge: TRANSACTION_SECONDS,
  });
}

/** Lê e apaga (uso único). Null se não houver, vencido ou adulterado. */
export async function takeTransaction(): Promise<SsoTransaction | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  store.delete({ name: COOKIE, path: "/api/auth/sso" });
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const { state, nonce, verifier } = payload as Partial<SsoTransaction>;
    return state && nonce && verifier ? { state, nonce, verifier } : null;
  } catch {
    return null;
  }
}

/** Redirect com headers mutáveis (Response.redirect não aceita os Set-Cookie que o Next acrescenta). */
export function redirectTo(url: string | URL): Response {
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}
