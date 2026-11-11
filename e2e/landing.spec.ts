import { test } from "@playwright/test";
import { ANA, RAFAEL, expect, login, logout } from "./helpers";

test("visitante sem sessão vê a landing do Farol Desk e o CTA leva ao login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/Farol Desk/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Farol Desk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Protótipo com dados fictícios", { exact: false }).first()).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Usar a demo" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("usuário logado em / vai direto para a sua área", async ({ page }) => {
  await login(page, ANA);
  await expect(page).toHaveURL(/\/atendimento$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/atendimento$/);

  await logout(page);
  await login(page, RAFAEL);
  await expect(page).toHaveURL(/\/console$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/console$/);
});

test("o topo toca a cena 3D do farol em loop, muda, e a prévia de link é a da landing", async ({ page }) => {
  await page.goto("/");
  const video = page.locator("#topo video");
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveJSProperty("loop", true);
  await expect(video).toHaveAttribute("playsinline", "");
  // Tela larga: o enquadramento horizontal (webm ou mp4, conforme o navegador).
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/\/landing\/farol-landing\.(webm|mp4)$/);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState >= 2 && !v.paused)).toBe(true);

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/.+\/landing\/og\.jpg$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const preview = await page.request.get("/landing/og.jpg");
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toBe("image/jpeg");
});

test("com movimento reduzido fica só o quadro parado: o vídeo nem é baixado", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const videos: string[] = [];
  page.on("request", (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) videos.push(request.url());
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("#topo img").first()).toBeVisible();
  await expect.poll(() => page.locator("#topo img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.locator("#topo video").evaluate((v: HTMLVideoElement) => v.currentSrc)).toBe("");
  expect(videos).toEqual([]);
  await context.close();
});

test("as âncoras da barra levam às seções e a barra fica clara depois do topo", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header).toHaveAttribute("data-solid", "false");
  await header.getByRole("link", { name: "Números" }).click();
  await expect(page).toHaveURL(/#numeros$/);
  await expect(page.getByRole("heading", { name: "Números, com a fonte." })).toBeInViewport();
  await expect(header).toHaveAttribute("data-solid", "true");

  // Cada número leva à sua fonte no repositório, em nova aba.
  const sources = page.locator("#numeros").getByRole("link");
  await expect(sources).toHaveCount(4);
  for (const link of await sources.all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\/github\.com\/skarL007\/nexo-assist\/blob\/main\/docs\/validacao\//);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});

test("no celular, a landing cabe na largura, usa o vídeo vertical e o menu abre as seções", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await expect
    .poll(() => page.locator("#topo video").evaluate((v: HTMLVideoElement) => v.currentSrc))
    .toMatch(/\/landing\/farol-landing-retrato\.(webm|mp4)$/);

  const header = page.getByRole("banner");
  const toggle = header.getByRole("button", { name: "Abrir menu" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const menu = header.getByRole("navigation", { name: "Seções" });
  await expect(menu.getByRole("link")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await toggle.click();
  await menu.getByRole("link", { name: "Como funciona" }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/#como-funciona$/);
  await expect(page.getByRole("heading", { name: "Do problema ao chamado, numa conversa só." })).toBeInViewport();
  await context.close();
});
