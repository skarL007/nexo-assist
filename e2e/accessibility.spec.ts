import AxeBuilder from "@axe-core/playwright";
import { test, type Page } from "@playwright/test";
import { ANA, RAFAEL, expect, login } from "./helpers";

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
}

for (const width of [390, 1440]) {
  test.describe(`acessibilidade em ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: "reduce" });

    test("landing e login têm nomes, semântica e contraste acessíveis", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await accessible(page);
      await page.goto("/login");
      await accessible(page);
    });

    test("atendimento e perfil têm nomes, semântica e contraste acessíveis", async ({ page }) => {
      await login(page, ANA);
      await expect(page).toHaveURL(/\/atendimento$/);
      await expect(page.getByPlaceholder("Escreva para o Farol…")).toBeVisible();
      await accessible(page);
      await page.goto("/perfil");
      await accessible(page);
    });

    test("login funciona só com teclado e mantém o foco visível", async ({ page }) => {
      await page.goto("/login");
      const email = page.getByLabel("E-mail corporativo");
      for (let i = 0; i < 8 && !(await email.evaluate((el) => el === document.activeElement)); i++) {
        await page.keyboard.press("Tab");
      }
      await expect(email).toBeFocused();
      expect(await email.evaluate((el) => el.matches(":focus-visible") && getComputedStyle(el).boxShadow !== "none")).toBe(true);
      await page.keyboard.insertText(ANA);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Esqueci minha senha" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
      await page.keyboard.insertText("demo");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/atendimento$/);
    });

    test("console e indicadores têm nomes, semântica e contraste acessíveis", async ({ page }) => {
      await login(page, RAFAEL);
      await expect(page.getByRole("button", { name: /Bruno Tavares/ })).toBeVisible();
      await accessible(page);
      await page.getByRole("button", { name: /Bruno Tavares/ }).click();
      await expect(page.getByRole("button", { name: "Assumir atendimento" })).toBeVisible();
      await accessible(page);
      await page.goto("/console/indicadores");
      await expect(page.getByRole("region", { name: "Principais indicadores" })).toBeVisible();
      await accessible(page);
    });
  });
}
