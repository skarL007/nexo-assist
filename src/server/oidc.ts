/**
 * SSO opcional com OpenID Connect (authorization code + PKCE). Serve para
 * Microsoft Entra, Google Workspace, Okta ou qualquer provedor OIDC.
 * Sem imports do Next: as rotas fazem a cola (cookie, redirect) e aqui fica o
 * que dá para testar contra um provedor falso.
 */
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  label: string;
  /** Só e-mails deste domínio (ex.: "nexo.com.br"). */
  allowedDomain?: string;
}

export interface OidcProvider {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

/** Motivo da recusa: vira ?sso=… no login, nunca o detalhe técnico. */
export type SsoFailure = "state" | "provider" | "exchange" | "token" | "email" | "domain" | "unknown_employee";

export class SsoError extends Error {
  constructor(
    readonly reason: SsoFailure,
    detail?: string,
  ) {
    super(detail ?? reason);
  }
}

export function oidcConfig(env: {
  OIDC_ISSUER?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_LABEL: string;
  OIDC_ALLOWED_DOMAIN?: string;
}): OidcConfig | null {
  if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) return null;
  return { issuer: env.OIDC_ISSUER, clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET, label: env.OIDC_LABEL, allowedDomain: env.OIDC_ALLOWED_DOMAIN };
}

const base64url = (buffer: Buffer) => buffer.toString("base64url");
export const randomToken = () => base64url(randomBytes(32));

/** PKCE (RFC 7636): o código só vale para quem tem o verifier que gerou o challenge. */
export function pkce(verifier = randomToken()): { verifier: string; challenge: string } {
  return { verifier, challenge: base64url(createHash("sha256").update(verifier).digest()) };
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export async function discover(issuer: string, fetchImpl: typeof fetch = fetch): Promise<OidcProvider> {
  const response = await fetchImpl(`${trimSlash(issuer)}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!response?.ok) throw new SsoError("provider", "descoberta do provedor falhou");
  const provider = (await response.json()) as OidcProvider;
  // O documento tem de ser do mesmo emissor configurado (evita trocar de provedor por baixo).
  if (trimSlash(provider.issuer) !== trimSlash(issuer)) throw new SsoError("provider", "issuer diferente do configurado");
  return provider;
}

export function authorizationUrl(provider: OidcProvider, config: OidcConfig, params: { redirectUri: string; state: string; nonce: string; challenge: string }) {
  const url = new URL(provider.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: params.redirectUri,
    scope: "openid email profile",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** Troca o código pelo id_token (canal servidor → provedor, com o segredo do cliente). */
export async function exchangeCode(input: {
  provider: OidcProvider;
  config: OidcConfig;
  code: string;
  verifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const response = await (input.fetchImpl ?? fetch)(input.provider.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      code_verifier: input.verifier,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) throw new SsoError("exchange", `token endpoint respondeu ${response?.status ?? "sem resposta"}`);
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new SsoError("exchange", "sem id_token");
  return body.id_token;
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

/** Valida o id_token e devolve o e-mail (em minúsculas). */
export async function verifyIdToken(
  idToken: string,
  input: { provider: OidcProvider; config: OidcConfig; nonce: string; keys?: JWTVerifyGetKey },
): Promise<string> {
  let keys = input.keys ?? remoteKeys.get(input.provider.jwks_uri);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(input.provider.jwks_uri));
    remoteKeys.set(input.provider.jwks_uri, keys);
  }
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: input.provider.issuer,
    audience: input.config.clientId,
    algorithms: ["RS256", "ES256", "PS256"],
    clockTolerance: 30,
  }).catch((error: unknown) => {
    throw new SsoError("token", error instanceof Error ? error.message : String(error));
  });
  if (payload.nonce !== input.nonce) throw new SsoError("token", "nonce diferente");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  // Sem e-mail verificado não dá para ligar a pessoa a um funcionário com segurança.
  if (!email || payload.email_verified === false) throw new SsoError("email", "e-mail ausente ou não verificado");
  if (input.config.allowedDomain && !email.endsWith(`@${input.config.allowedDomain.toLowerCase()}`)) throw new SsoError("domain", email.split("@")[1]);
  return email;
}
