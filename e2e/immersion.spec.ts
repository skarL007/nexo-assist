import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a cena responde ao ponteiro e permite navegar por capítulos sem prender a página", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#imersao");
  await page.evaluate(() => window.scrollTo(0, document.getElementById("imersao")!.offsetTop));
  await expect(section.getByRole("navigation", { name: "Capítulos da cena" })).toBeVisible();
  const second = section.getByRole("button", { name: "02 Consultar" });
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("banner")).toHaveAttribute("data-solid", "false");
  await expect.poll(async () => Number(await section.locator("canvas").getAttribute("data-frame"))).toBeGreaterThan(40);
  await page.mouse.move(1100, 300);
  await expect.poll(() => section.evaluate(el => Number(el.style.getPropertyValue("--scene-x")))).toBeGreaterThan(0.2);
  const accessibility = await new AxeBuilder({ page }).include("#imersao").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await section.getByRole("link", { name: "Pular cena" }).click();
  await expect(page).toHaveURL(/#por-que$/);
  await expect(page.locator("#por-que")).toBeInViewport();
});

test("sem canvas, a cena preserva o pôster e as três frases", async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto("/");
  const section = page.locator("#imersao");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute("data-scene-state", "fallback");
  for (const phrase of ["Toda pergunta de TI vira uma conversa.", "O agent entende, consulta e decide.", "E mostra o porquê."]) await expect(section.getByText(phrase)).toBeVisible();
  await expect(section.locator("img")).toBeVisible();
  expect(await section.evaluate(el => el.getBoundingClientRect().height / window.innerHeight)).toBeLessThan(1.3);
});

test("no celular a cena mantém controles acessíveis e não inclina com toque", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.getElementById("imersao")!.offsetTop));
  await page.getByRole("button", { name: "03 Entender" }).click();
  await expect(page.getByRole("button", { name: "03 Entender" })).toHaveAttribute("aria-current", "step");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});
