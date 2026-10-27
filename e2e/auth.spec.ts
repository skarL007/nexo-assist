import { test } from "@playwright/test";
import { ANA, expect, login, RAFAEL } from "./helpers";

test("funcionário entra e cai no chat", async ({ page }) => {
  await login(page, ANA);
  await expect(page).toHaveURL(/\/atendimento$/);
  await expect(page.getByText("Olá, Ana!")).toBeVisible();
  await expect(page.getByText("0/30 mensagens nesta sessão")).toBeVisible();
});

test("analista entra e cai no console", async ({ page }) => {
  await login(page, RAFAEL);
  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByRole("heading", { name: "Conversas" })).toBeVisible();
});

test("e-mail fora da Nexo é recusado antes de ir ao servidor", async ({ page }) => {
  await login(page, "alguem@gmail.com");
  await expect(page.getByText("Use seu e-mail corporativo @nexo.com.br")).toBeVisible();
});

test("funcionário não acessa o console nem a API do analista", async ({ page }) => {
  await login(page, ANA);
  await expect(page).toHaveURL(/\/atendimento$/);

  await page.goto("/console");
  await expect(page).toHaveURL(/\/atendimento$/);

  const response = await page.request.get("/api/console/conversations");
  expect(response.status()).toBe(403);
});

test("sem login, a API do chat responde 401", async ({ request }) => {
  const response = await request.get("/api/chat");
  expect(response.status()).toBe(401);
});
