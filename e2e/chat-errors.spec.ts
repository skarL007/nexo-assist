import { test } from "@playwright/test";
import { ANA, expect, login, RAFAEL } from "./helpers";

/** Sem LLM: o envio é interceptado. Quando falha, o texto volta para o campo e o aviso é em português. */
test("sem chave do modelo: aviso claro e o texto volta para o campo", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const line = { type: "error", message: "O Nexo Assist não está configurado neste ambiente: defina GOOGLE_GENERATIVE_AI_API_KEY no .env e reinicie o servidor." };
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify(line) + "\n" });
  });
  await login(page, ANA);
  await page.locator("footer textarea").fill("Minha VPN dá erro 809");
  await page.keyboard.press("Enter");
  await expect(page.getByText("não está configurado neste ambiente")).toBeVisible();
  await expect(page.locator("footer textarea")).toHaveValue("Minha VPN dá erro 809");
});

test("sem conexão: aviso em português e o texto volta para o campo", async ({ page }) => {
  await page.route("**/api/chat", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  await login(page, ANA);
  await page.locator("footer textarea").fill("Como está o INC-20311?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Sem conexão com o servidor")).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  await expect(page.locator("footer textarea")).toHaveValue("Como está o INC-20311?");
});

test("console: se abrir a conversa falhar, mostra o erro com Tentar de novo (não fica carregando para sempre)", async ({ page }) => {
  await page.route("**/api/console/conversations/*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ status: 503, json: { error: "O sistema de chamados está indisponível no momento." } }) : route.fallback(),
  );
  await login(page, RAFAEL);
  await expect(page.getByText("Não foi possível abrir esta conversa.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
});
