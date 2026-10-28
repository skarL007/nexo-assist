import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Incidente em massa sem LLM: o seed tem três pessoas com o sistema de ponto fora
 * do ar na última hora e meia. O console avisa, sem nomes nem números de chamado.
 */
test("console avisa do possível incidente em massa, sem dizer quem relatou", async ({ page }) => {
  await login(page, RAFAEL);
  const banner = page.getByRole("status").filter({ hasText: "Possível incidente em massa" });
  await expect(banner).toHaveText(/Software · ponto · 3 relatos de 3 pessoas desde \d{2}:\d{2}/);
  for (const secret of ["Gustavo", "Helena", "Igor", "INC-2033"]) await expect(banner).not.toContainText(secret);
});
