import { describe, expect, it } from "vitest";
import { demoLoginEnabled } from "./auth-mode";

const sso = { OIDC_ISSUER: "https://idp.example.com", OIDC_CLIENT_ID: "nexo", OIDC_CLIENT_SECRET: "s3cr3t", OIDC_LABEL: "Entra" };
const semSso = { OIDC_LABEL: "SSO corporativo" };

describe("login de demonstração (só e-mail, sem senha)", () => {
  it("sem SSO, vale por padrão: é o único jeito de entrar no protótipo", () => {
    expect(demoLoginEnabled(semSso)).toBe(true);
  });

  it("com SSO configurado, desliga por padrão: não vira rota alternativa ao SSO (auditoria de 02/11, P0)", () => {
    expect(demoLoginEnabled(sso)).toBe(false);
  });

  it("DEMO_LOGIN explícito manda nos dois casos", () => {
    expect(demoLoginEnabled({ ...sso, DEMO_LOGIN: "1" })).toBe(true);
    expect(demoLoginEnabled({ ...semSso, DEMO_LOGIN: "0" })).toBe(false);
  });

  it("SSO pela metade (sem o segredo) não conta como SSO", () => {
    expect(demoLoginEnabled({ ...sso, OIDC_CLIENT_SECRET: undefined })).toBe(true);
  });
});
