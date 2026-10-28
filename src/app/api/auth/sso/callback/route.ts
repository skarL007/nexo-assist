import { createServices } from "@/infrastructure/container";
import { exchangeCode, SsoError, verifyIdToken } from "@/server/oidc";
import { homeFor, startSession } from "@/server/session";
import { callbackUrl, redirectTo, ssoConfig, ssoProvider, takeTransaction } from "@/server/sso";

/**
 * GET /api/auth/sso/callback → volta do provedor. Confere o state, troca o código,
 * valida o id_token e entra como o funcionário com aquele e-mail (só quem já existe).
 */
export async function GET(request: Request) {
  const back = (reason: string) => redirectTo(new URL(`/login?sso=${reason}`, request.url));
  const config = ssoConfig();
  if (!config) return Response.json({ error: "SSO não configurado." }, { status: 404 });

  const params = new URL(request.url).searchParams;
  const transaction = await takeTransaction();
  try {
    // state confere com o cookie desta pessoa: impede CSRF de login (alguém entrar você na conta dele).
    if (!transaction || !params.get("state") || params.get("state") !== transaction.state) throw new SsoError("state");
    const code = params.get("code");
    if (!code) throw new SsoError("exchange", params.get("error") ?? "sem código");

    const provider = await ssoProvider(config);
    const idToken = await exchangeCode({ provider, config, code, verifier: transaction.verifier, redirectUri: callbackUrl(request) });
    const email = await verifyIdToken(idToken, { provider, config, nonce: transaction.nonce });

    const employee = await createServices().employees.findByEmail(email);
    if (!employee) throw new SsoError("unknown_employee");
    await startSession(employee);
    return redirectTo(new URL(homeFor(employee.role), request.url));
  } catch (error) {
    const reason = error instanceof SsoError ? error.reason : "provider";
    console.error(`[sso] recusado: ${reason}${error instanceof Error && error.message !== reason ? ` (${error.message})` : ""}`);
    return back(reason === "unknown_employee" ? "desconhecido" : reason === "domain" ? "dominio" : "falhou");
  }
}
