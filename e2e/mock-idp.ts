/**
 * Provedor OpenID Connect falso, só para o E2E do SSO (porta 3200).
 * Faz o mínimo de um provedor de verdade: descoberta, tela de login, código de
 * uso único preso ao redirect, PKCE S256 conferido, segredo do cliente conferido,
 * id_token RS256 com nonce e JWKS. Se o app errar em algum passo, o fluxo quebra.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const PORT = 3200;
const ISSUER = `http://localhost:${PORT}`;
const CLIENT_ID = "nexo-e2e";
const CLIENT_SECRET = "e2e-client-secret";

interface PendingCode {
  email: string;
  nonce: string;
  redirectUri: string;
  challenge: string;
}

async function main() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "e2e", alg: "RS256", use: "sig" };
  const codes = new Map<string, PendingCode>();

  createServer((req, res) => {
    const url = new URL(req.url ?? "/", ISSUER);
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const json = (status: number, data: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(data));

      if (url.pathname === "/.well-known/openid-configuration") {
        return json(200, { issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/jwks` });
      }
      if (url.pathname === "/jwks") return json(200, { keys: [jwk] });

      if (url.pathname === "/authorize" && req.method === "GET") {
        const p = url.searchParams;
        if (p.get("client_id") !== CLIENT_ID || p.get("code_challenge_method") !== "S256" || p.get("response_type") !== "code") return json(400, { error: "invalid_request" });
        const hidden = ["redirect_uri", "state", "nonce", "code_challenge"].map((k) => `<input type="hidden" name="${k}" value="${p.get(k) ?? ""}">`).join("");
        return res
          .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
          .end(`<!doctype html><title>Provedor de teste</title><form method="post" action="/authorize">${hidden}<label>E-mail no provedor <input name="email"></label><button>Continuar</button></form>`);
      }
      if (url.pathname === "/authorize" && req.method === "POST") {
        const form = new URLSearchParams(body);
        const code = randomBytes(16).toString("hex");
        codes.set(code, { email: form.get("email") ?? "", nonce: form.get("nonce") ?? "", redirectUri: form.get("redirect_uri") ?? "", challenge: form.get("code_challenge") ?? "" });
        const back = new URL(form.get("redirect_uri") ?? "");
        back.searchParams.set("code", code);
        back.searchParams.set("state", form.get("state") ?? "");
        return res.writeHead(302, { Location: back.toString() }).end();
      }

      if (url.pathname === "/token" && req.method === "POST") {
        const form = new URLSearchParams(body);
        const pending = codes.get(form.get("code") ?? "");
        codes.delete(form.get("code") ?? ""); // uso único
        const verifierOk = pending && createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url") === pending.challenge;
        if (!pending || !verifierOk || form.get("client_secret") !== CLIENT_SECRET || form.get("redirect_uri") !== pending.redirectUri) {
          return json(400, { error: "invalid_grant" });
        }
        const idToken = await new SignJWT({ email: pending.email, email_verified: true, nonce: pending.nonce })
          .setProtectedHeader({ alg: "RS256", kid: "e2e" })
          .setIssuer(ISSUER)
          .setAudience(CLIENT_ID)
          .setSubject(pending.email)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        return json(200, { access_token: "x", token_type: "Bearer", id_token: idToken });
      }
      json(404, { error: "not_found" });
    });
  }).listen(PORT, () => console.log(`Provedor OIDC de teste em ${ISSUER}`));
}

void main();
