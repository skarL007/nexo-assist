import { test, type Browser, type Page } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Tempo real (SSE) com medição. Um segundo analista (outra aba, outro contexto)
 * escreve na conversa da Elisa; medimos quanto tempo a mensagem leva para
 * aparecer no console aberto, com o stream e com o polling (?ao-vivo=0).
 * Sem LLM. Devolve a conversa ao agent no fim.
 */
const ELISA = "elisa.prado@nexo.com.br";
const CONVERSATION = "conv-elisa";
const TRIALS = 8;

async function analystApi(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, RAFAEL);
  await page.waitForURL("**/console");
  const origin = new URL(page.url()).origin;
  const post = async (path: string, data: object) => {
    const response = await page.request.post(path, { data, headers: { Origin: origin } });
    expect(response.ok(), `${path} → ${response.status()}`).toBe(true);
  };
  return {
    action: (action: "assume" | "release") => post(`/api/console/conversations/${CONVERSATION}`, { action }),
    send: (text: string) => post(`/api/console/conversations/${CONVERSATION}/messages`, { text }),
    close: () => context.close(),
  };
}

/** Abre o console (já logado) na conversa da Elisa. */
async function openElisa(page: Page, query = "") {
  await page.goto(`/console${query}`);
  await page.getByRole("tab", { name: /^Todas/ }).click();
  await page.getByRole("button", { name: /Elisa Prado/ }).click();
  await expect(page.getByLabel("Resposta do analista")).toBeVisible(); // a conversa já é do Rafael
}

/** Tempo (ms) entre a gravação no servidor e o texto aparecer na tela. */
async function measure(page: Page, send: (text: string) => Promise<void>, label: string): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < TRIALS; i++) {
    // Espera variada: não sincronizar com o ciclo do polling (seria sorte ou azar sempre igual).
    await page.waitForTimeout(300 + Math.floor(Math.random() * 1200));
    const marker = `medição ${label} ${i} ${Math.random().toString(36).slice(2, 7)}`;
    await send(marker);
    const sent = Date.now();
    await page.waitForFunction((text) => document.body.innerText.includes(text), marker, { polling: 25, timeout: 15_000 });
    times.push(Date.now() - sent);
  }
  return times;
}

function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return { median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}

test("mensagem nova aparece no console mais rápido com o stream do que com o polling", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const other = await analystApi(browser);
  await other.action("assume");

  try {
    await login(page, RAFAEL);
    await page.waitForURL("**/console");
    await openElisa(page);
    await expect(page.getByTestId("live-indicator")).toHaveText("Ao vivo");
    const live = await measure(page, other.send, "ao vivo");

    await openElisa(page, "?ao-vivo=0");
    await expect(page.getByTestId("live-indicator")).toHaveText("Atualiza a cada 4 s");
    const polling = await measure(page, other.send, "polling");

    const result = { trials: TRIALS, live: { ...stats(live), times: live }, polling: { ...stats(polling), times: polling } };
    console.log(`[tempo-real] ${JSON.stringify(result)}`);
    await test.info().attach("latencia-tempo-real.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });

    expect(result.live.p95).toBeLessThan(2000);
    expect(result.live.median).toBeLessThan(result.polling.median);
  } finally {
    await other.action("release");
    await other.close();
  }
});

test("se o stream cair, o console volta ao polling e continua atualizando", async ({ page, browser }) => {
  await page.route("**/api/console/stream", (route) => route.fulfill({ status: 503, body: "" }));
  const other = await analystApi(browser);
  await other.action("assume");
  try {
    await login(page, RAFAEL);
    await page.waitForURL("**/console");
    await openElisa(page);
    await expect(page.getByTestId("live-indicator")).toHaveText("Atualiza a cada 4 s");
    await page.waitForTimeout(500);
    await other.send("chegou mesmo sem o stream");
    await expect(page.getByText("chegou mesmo sem o stream").first()).toBeVisible({ timeout: 8000 });
  } finally {
    await other.action("release");
    await other.close();
  }
});

test("funcionária vê a resposta do analista ao vivo, sem recarregar", async ({ page, browser }) => {
  const other = await analystApi(browser);
  await other.action("assume");
  try {
    // A página assina /api/chat/stream enquanto o analista atende; espera o stream abrir.
    const streamOpened = page.waitForResponse("**/api/chat/stream");
    await login(page, ELISA);
    await expect(page.getByText(/está atendendo você agora/)).toBeVisible();
    await streamOpened;
    await page.waitForTimeout(500);
    await other.send("Oi, Elisa! Já estou olhando o Wi-Fi da sala 3.");
    const sent = Date.now();
    await page.waitForFunction(() => document.body.innerText.includes("Já estou olhando o Wi-Fi da sala 3"), undefined, { polling: 25, timeout: 10_000 });
    const elapsed = Date.now() - sent;
    console.log(`[tempo-real] funcionária: ${elapsed} ms`);
    expect(elapsed).toBeLessThan(2000);
  } finally {
    await other.action("release");
    await other.close();
  }
});
