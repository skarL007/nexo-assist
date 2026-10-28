import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("qualquer-senha");
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function logout(page: Page) {
  await page.request.post("/api/auth/logout");
}

export const ANA = "ana.souza@nexo.com.br";
export const CARLA = "carla.mendes@nexo.com.br";
export const DIEGO = "diego.ramos@nexo.com.br";
export const RAFAEL = "rafael.lima@nexo.com.br";

export { expect };
