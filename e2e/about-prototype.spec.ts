import { test, type Locator } from "@playwright/test";
import { ANA, expect, login } from "./helpers";

const CASE_STUDY = "https://skarl007.github.io/nexo-assist/";
const DEMO_URL = "https://nexo-assist-puce.vercel.app";

async function expectCaseStudyLink(link: Locator) {
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", CASE_STUDY);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
}

test("login: 'Sobre este protótipo' abre o estudo de caso em nova aba", async ({ page }) => {
  await page.goto("/login");
  await expectCaseStudyLink(page.getByRole("link", { name: "Sobre este protótipo" }));
});

test("chat: a nota embaixo da caixa de mensagem leva ao estudo de caso", async ({ page }) => {
  await login(page, ANA);
  await expect(page).toHaveURL(/\/atendimento$/);
  await expectCaseStudyLink(page.locator("footer").getByRole("link", { name: "Sobre este protótipo" }));
});

test("prévia ao compartilhar: Open Graph e cartão do X com a tela do produto", async ({ page, request }) => {
  await page.goto("/login");
  const meta = (selector: string) => page.locator(`head meta[${selector}]`).first();

  await expect(meta('property="og:title"')).toHaveAttribute("content", "Nexo Assist");
  await expect(meta('property="og:description"')).toHaveAttribute("content", "Service desk de TI da Nexo, numa conversa.");
  await expect(meta('property="og:image"')).toHaveAttribute("content", new RegExp(`^${DEMO_URL}/opengraph-image\\.png`));
  await expect(meta('property="og:image:width"')).toHaveAttribute("content", "1200");
  await expect(meta('property="og:image:height"')).toHaveAttribute("content", "630");
  await expect(meta('name="twitter:card"')).toHaveAttribute("content", "summary_large_image");
  await expect(meta('name="twitter:image"')).toHaveAttribute("content", new RegExp(`^${DEMO_URL}/twitter-image\\.png`));

  for (const path of ["/opengraph-image.png", "/twitter-image.png"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});
