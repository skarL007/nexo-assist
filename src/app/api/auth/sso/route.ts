import { authorizationUrl, pkce, randomToken } from "@/server/oidc";
import { callbackUrl, redirectTo, saveTransaction, ssoConfig, ssoProvider } from "@/server/sso";
import { logError } from "@/server/http";

/** GET /api/auth/sso → leva ao provedor OIDC (só com SSO configurado). */
export async function GET(request: Request) {
  const config = ssoConfig();
  if (!config) return Response.json({ error: "SSO não configurado." }, { status: 404 });
  try {
    const provider = await ssoProvider(config);
    const state = randomToken();
    const nonce = randomToken();
    const { verifier, challenge } = pkce();
    await saveTransaction({ state, nonce, verifier });
    return redirectTo(authorizationUrl(provider, config, { redirectUri: callbackUrl(request), state, nonce, challenge }));
  } catch (error) {
    logError(error);
    return redirectTo(new URL("/login?sso=falhou", request.url));
  }
}
