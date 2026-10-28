import { test } from "@playwright/test";
import { expect } from "./helpers";

test("endereço que não existe mostra a página 404 em português, no visual do app", async ({ page }) => {
  const response = await page.goto("/pagina-que-nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByText("could not be found")).toHaveCount(0);
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL(/\/login/);
});
