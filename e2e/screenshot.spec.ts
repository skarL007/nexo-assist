import { test, type Browser } from "@playwright/test";
import { CARLA, expect, login, RAFAEL } from "./helpers";

/**
 * Imagem anexada (docs/specs/02-agent.md#captura-de-tela), sem LLM: a conversa da Elisa está com
 * o Rafael, então a imagem vai para o analista e o modelo de visão não é chamado.
 * Confere o anexo pelo clipe, a miniatura nos dois lados, o 404 para outra pessoa e a recusa de SVG.
 */
const ELISA = "elisa.prado@nexo.com.br";
const CONVERSATION = "conv-elisa";

async function asRafael(browser: Browser, action: "assume" | "release") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, RAFAEL);
  await page.waitForURL("**/console");
  const response = await page.request.post(`/api/console/conversations/${CONVERSATION}`, {
    data: { action },
    headers: { Origin: new URL(page.url()).origin },
  });
  // assume numa conversa que já é dele responde 409: o que importa é ela ficar com o Rafael.
  expect([200, 409]).toContain(response.status());
  await context.close();
}

test("funcionária anexa uma foto; ela e o analista veem, outra pessoa recebe 404", async ({ page, browser }) => {
  await asRafael(browser, "assume");

  // Uma imagem PNG de verdade: o recorte de uma página qualquer.
  await page.setContent('<div style="width:400px;height:240px;background:#111;color:#eee;font:20px sans-serif;padding:20px">Sem sinal · HDMI 1</div>');
  const photo = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 240 } });

  await login(page, ELISA);
  await page.waitForURL("**/atendimento");
  await page.getByLabel("Escolher imagem").setInputFiles({ name: "monitor.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByAltText("Imagem anexada")).toBeVisible();
  await page.getByLabel("Mensagem").fill("o monitor não liga, segue a foto");
  await page.getByRole("button", { name: "Enviar" }).click();

  const sent = page.getByAltText("Imagem anexada pelo funcionário").last();
  await expect(sent).toBeVisible();
  const src = await sent.getAttribute("src");
  expect(src).toMatch(/^\/api\/chat\/screenshots\//);
  await expect.poll(() => sent.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const own = await page.request.get(src!);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("image/jpeg");
  expect(own.headers()["x-content-type-options"]).toBe("nosniff");

  // O analista vê a mesma imagem no console.
  const rafael = await browser.newPage();
  await login(rafael, RAFAEL);
  await rafael.waitForURL("**/console");
  await rafael.getByRole("tab", { name: /^Todas/ }).click();
  await rafael.getByRole("button", { name: /Elisa Prado/ }).click();
  await expect(rafael.getByAltText("Imagem anexada pelo funcionário").last()).toBeVisible();
  expect((await rafael.request.get(src!)).status()).toBe(200);
  await rafael.close();

  // Outra funcionária não vê a imagem da Elisa.
  const carla = await browser.newPage();
  await login(carla, CARLA);
  await carla.waitForURL("**/atendimento");
  expect((await carla.request.get(src!)).status()).toBe(404);
  await carla.close();

  // Sem sessão: 401.
  expect((await page.context().request.fetch(src!, { headers: { cookie: "" } })).status()).toBeGreaterThanOrEqual(400);
});

test("SVG disfarçado de PNG é recusado e nada é gravado", async ({ page, browser }) => {
  await asRafael(browser, "assume");
  await login(page, ELISA);
  await page.waitForURL("**/atendimento");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
  const response = await page.request.post("/api/chat", {
    data: { text: "olha isso", image: { mime: "image/png", data: svg } },
    headers: { Origin: new URL(page.url()).origin },
  });
  const body = await response.text();
  expect(body).toContain("PNG, JPEG ou WebP");
  expect(body).not.toContain("employee_message");
  await asRafael(browser, "release");
});
