import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

test("analista abre os indicadores pelo console", async ({ page }) => {
  await login(page, RAFAEL);
  await page.getByRole("link", { name: "Indicadores" }).click();
  await expect(page.getByRole("heading", { name: "Indicadores" })).toBeVisible();

  const main = page.getByRole("region", { name: "Principais indicadores" });
  await expect(main.getByText("Resolvido sem analista")).toBeVisible();
  // O valor depende do que os outros testes já fizeram no banco; aqui basta ser uma porcentagem.
  await expect(main.getByText(/^\d+%$/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Mais indicadores" }).getByText("Analistas no service desk")).toBeVisible();

  const handoffs = page.getByRole("region", { name: "Transferências por motivo" });
  await expect(handoffs.getByText("Funcionário pediu um analista")).toBeVisible();
  await expect(handoffs.getByText("Agent sem segurança para decidir")).toBeVisible();

  await page.getByRole("link", { name: "Conversas" }).click();
  await expect(page.getByText("Conversas", { exact: true }).first()).toBeVisible();
});

test("funcionário não abre os indicadores", async ({ page }) => {
  await login(page, "ana.souza@nexo.com.br");
  await page.goto("/console/indicadores");
  await expect(page).toHaveURL(/\/atendimento/);
});

test("o login mostra números deste ambiente, não os do protótipo", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("analistas no service desk")).toBeVisible();
  await expect(page.getByText("6", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Números deste ambiente nos últimos 30 dias.")).toBeVisible();
});
