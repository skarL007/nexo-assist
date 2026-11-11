import { test, type Page } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Console no celular, sem LLM (fila do seed: Carla e Bruno). Abaixo de 1024 px aparece um painel
 * por vez: a lista de conversas ou a conversa aberta (docs/specs/06-layout-responsivo.md).
 */
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("celular (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("o analista vê a fila, abre uma conversa e volta, sem rolagem horizontal", async ({ page }) => {
    await login(page, RAFAEL);
    await expect(page).toHaveURL(/\/console$/);
    const bruno = page.getByRole("button", { name: /Bruno Tavares/ });
    const assume = page.getByRole("button", { name: "Assumir atendimento" });

    // Abre na lista: a conversa não fica espremida ao lado.
    await expect(bruno).toBeVisible();
    await expect(assume).toBeHidden();
    expect(await fitsWidth(page)).toBe(true);

    await bruno.click();
    await expect(assume).toBeVisible();
    await expect(bruno).toBeHidden();
    expect(await fitsWidth(page)).toBe(true);

    await page.getByRole("button", { name: "Voltar para as conversas" }).click();
    await expect(bruno).toBeVisible();
    await expect(assume).toBeHidden();
  });

  test("os indicadores cabem na tela e o menu do topo leva de volta às conversas", async ({ page }) => {
    await login(page, RAFAEL);
    await expect(page).toHaveURL(/\/console$/);
    await page.goto("/console/indicadores");
    await expect(page.getByRole("region", { name: "Principais indicadores" })).toBeVisible();
    expect(await fitsWidth(page)).toBe(true);

    await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Conversas" }).click();
    await expect(page).toHaveURL(/\/console$/);
    await expect(page.getByRole("button", { name: /Bruno Tavares/ })).toBeVisible();
  });
});

test("desktop: lista e conversa lado a lado, sem botão de voltar", async ({ page }) => {
  await login(page, RAFAEL);
  await expect(page.getByRole("button", { name: /Bruno Tavares/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assumir atendimento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar para as conversas" })).toBeHidden();
});
