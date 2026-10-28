import { createHash } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { authorizationUrl, discover, exchangeCode, pkce, SsoError, verifyIdToken, type OidcConfig, type OidcProvider } from "./oidc";

const provider: OidcProvider = {
  issuer: "https://idp.example.com",
  authorization_endpoint: "https://idp.example.com/authorize",
  token_endpoint: "https://idp.example.com/token",
  jwks_uri: "https://idp.example.com/jwks",
};
const config: OidcConfig = { issuer: provider.issuer, clientId: "nexo", clientSecret: "s3cr3t", label: "Entra", allowedDomain: "nexo.com.br" };

let sign: (claims: JWTPayload, options?: { expiresIn?: string; issuer?: string; audience?: string }) => Promise<string>;
let signWithOtherKey: (claims: JWTPayload) => Promise<string>;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" }] });
  const make = (key: CryptoKey, kid: string) => (claims: JWTPayload, options: { expiresIn?: string; issuer?: string; audience?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(options.issuer ?? provider.issuer)
      .setAudience(options.audience ?? config.clientId)
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "5m")
      .sign(key);
  sign = make(pair.privateKey, "k1");
  signWithOtherKey = make(other.privateKey, "k1");
});

const verify = (token: string, nonce = "n-1") => verifyIdToken(token, { provider, config, nonce, keys });
const reason = (promise: Promise<unknown>) => promise.then(() => "ok", (error: SsoError) => error.reason);

describe("id_token", () => {
  it("válido devolve o e-mail em minúsculas", async () => {
    expect(await verify(await sign({ email: "Ana.Souza@nexo.com.br", email_verified: true, nonce: "n-1" }))).toBe("ana.souza@nexo.com.br");
  });

  it("recusa assinatura de outra chave, emissor ou público errados, vencido e nonce trocado", async () => {
    const claims = { email: "ana.souza@nexo.com.br", email_verified: true, nonce: "n-1" };
    expect(await reason(verify(await signWithOtherKey(claims)))).toBe("token");
    expect(await reason(verify(await sign(claims, { issuer: "https://evil.example.com" })))).toBe("token");
    expect(await reason(verify(await sign(claims, { audience: "outro-app" })))).toBe("token");
    expect(await reason(verify(await sign(claims, { expiresIn: "-5m" })))).toBe("token");
    expect(await reason(verify(await sign(claims), "n-outro"))).toBe("token");
  });

  it("recusa e-mail não verificado, ausente ou de outro domínio", async () => {
    expect(await reason(verify(await sign({ email: "ana.souza@nexo.com.br", email_verified: false, nonce: "n-1" })))).toBe("email");
    expect(await reason(verify(await sign({ nonce: "n-1" })))).toBe("email");
    expect(await reason(verify(await sign({ email: "ana@gmail.com", email_verified: true, nonce: "n-1" })))).toBe("domain");
  });
});

describe("pedido de autorização", () => {
  it("leva code + PKCE S256, state, nonce e o redirect", () => {
    const { verifier, challenge } = pkce("verificador-de-teste");
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    const url = new URL(authorizationUrl(provider, config, { redirectUri: "https://app/api/auth/sso/callback", state: "s", nonce: "n", challenge }));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "nexo",
      redirect_uri: "https://app/api/auth/sso/callback",
      scope: "openid email profile",
      state: "s",
      nonce: "n",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
  });
});

describe("provedor", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("descoberta recusa documento de outro emissor", async () => {
    const fake = (async () => json({ ...provider, issuer: "https://evil.example.com" })) as typeof fetch;
    expect(await reason(discover(provider.issuer, fake))).toBe("provider");
    expect(await discover(provider.issuer + "/", (async () => json(provider)) as typeof fetch)).toEqual(provider);
  });

  it("troca o código mandando o verifier e o segredo; erro do provedor vira 'exchange'", async () => {
    let sent: URLSearchParams | null = null;
    const ok = (async (_url: string, init: RequestInit) => {
      sent = init.body as URLSearchParams;
      return json({ id_token: "tok" });
    }) as unknown as typeof fetch;
    expect(await exchangeCode({ provider, config, code: "c", verifier: "v", redirectUri: "r", fetchImpl: ok })).toBe("tok");
    expect(Object.fromEntries(sent!)).toMatchObject({ grant_type: "authorization_code", code: "c", code_verifier: "v", client_secret: "s3cr3t" });
    expect(await reason(exchangeCode({ provider, config, code: "c", verifier: "v", redirectUri: "r", fetchImpl: (async () => json({}, 400)) as typeof fetch }))).toBe("exchange");
  });
});
