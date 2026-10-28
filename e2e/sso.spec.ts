import { test } from "@playwright/test";
import { expect } from "./helpers";

/**
 * SSO de ponta a ponta contra um provedor OIDC falso (e2e/mock-idp.ts): o navegador
 * vai ao provedor, volta com o código, o servidor troca e valida o id_token.
 */
async function signInWithProvider(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Entrar com Nexo SSO (teste)" }).click();
  await expect(page).toHaveTitle("Provedor de teste");
  await page.getByLabel("E-mail no provedor").fill(email);
  await page.getByRole("button", { name: "Continuar" }).click();
}

test("Ana entra pelo SSO e cai no chat dela", async ({ page }) => {
  await signInWithProvider(page, "ana.souza@nexo.com.br");
  await page.waitForURL("**/atendimento");
  const me = await page.request.get("/api/chat");
  expect(me.ok()).toBe(true);
});

test("analista entra pelo SSO e cai no console", async ({ page }) => {
  await signInWithProvider(page, "rafael.lima@nexo.com.br");
  await page.waitForURL("**/console");
});

test("e-mail fora da base volta ao login com o aviso, sem sessão", async ({ page }) => {
  await signInWithProvider(page, "estranho@nexo.com.br");
  await page.waitForURL("**/login?sso=desconhecido");
  await expect(page.getByRole("alert").filter({ hasText: "service desk" })).toHaveText(/Seu e-mail não está no service desk/);
  expect((await page.request.get("/api/chat")).status()).toBe(401);
});

test("conta de fora do domínio é recusada", async ({ page }) => {
  await signInWithProvider(page, "ana@gmail.com");
  await page.waitForURL("**/login?sso=dominio");
  await expect(page.getByRole("alert").filter({ hasText: "conta corporativa" })).toBeVisible();
});

test("volta com state adulterado é recusada (CSRF de login)", async ({ page }) => {
  // Começa um login de verdade (o cookie da transação existe) e volta com outro state.
  await page.goto("/login");
  await page.getByRole("link", { name: "Entrar com Nexo SSO (teste)" }).click();
  await expect(page).toHaveTitle("Provedor de teste");
  await page.goto("/api/auth/sso/callback?code=qualquer&state=outro");
  await page.waitForURL("**/login?sso=falhou");
  expect((await page.request.get("/api/chat")).status()).toBe(401);
});
