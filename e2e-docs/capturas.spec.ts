import { test, type Page } from "@playwright/test";
import type { ConversationView } from "@/contracts/chat";
import { ANA, expect, login, RAFAEL } from "../e2e/helpers";

const ELISA = "elisa.prado@nexo.com.br";

/**
 * Percorre as telas principais e salva uma captura de cada em docs/capturas/. Antes de cada
 * captura, o teste confere o conteúdo: se a tela mudar, o teste falha em vez de documentar errado.
 */
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/capturas/${name}.png`, fullPage: false, animations: "disabled" });

/** Prévia de link (1200 × 630): composição própria, no visual do app, com a marca e a frase do produto. */
const OG_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=block">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:#f5f5f7;color:#1d1d1f;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
    display:grid;grid-template-columns:1.05fr .95fr;gap:56px;padding:72px 80px;align-items:center}
  .brand{display:flex;align-items:center;gap:14px;font-weight:600;font-size:24px;letter-spacing:-.01em;margin-bottom:40px}
  .mark{width:48px;height:48px;border-radius:13px;background:#1d1d1f;display:grid;place-items:center}
  h1{font-size:64px;line-height:1.02;font-weight:700;letter-spacing:-.035em}
  p.sub{margin-top:24px;font-size:24px;line-height:1.4;color:#6e6e73;max-width:24ch;text-wrap:balance}
  .card{background:#fff;border-radius:28px;padding:28px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 24px 60px -20px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:14px;font-size:19px}
  .me{align-self:flex-end;background:#0e6a78;color:#fff;border-radius:22px 22px 6px 22px;padding:12px 18px;max-width:90%}
  .steps{display:flex;align-items:center;gap:10px;color:#6e6e73;font-size:15px;white-space:nowrap}
  .dot{width:8px;height:8px;border-radius:9px;background:#f2b84b}
  .why{background:#fbf3df;color:#7a5512;border-radius:999px;padding:3px 12px;font-weight:600;white-space:nowrap}
  .bot{background:#f2f2f4;border-radius:22px 22px 22px 6px;padding:12px 18px;max-width:92%}
</style></head><body>
<div>
  <div class="brand"><span class="mark"><svg width="30" height="30" viewBox="0 0 24 24" fill="#f2b84b"><path d="M13.2 8.4 22 4.4v8z" opacity=".5"/><path d="M7.6 6.7 10.5 3.6l2.9 3.1z"/><rect x="8.5" y="7.3" width="4" height="2.7" rx=".5"/><path d="M8.8 10.8h3.4l1.1 8.6H7.7z"/><rect x="6.2" y="19.8" width="8.6" height="1.6" rx=".6"/></svg></span>Farol Desk</div>
  <h1>Service desk de TI, com o porquê à vista.</h1>
  <p class="sub">O agent resolve em uma conversa e mostra o que entendeu, o que fez e por quê.</p>
</div>
<div class="card">
  <div class="me">Meu notebook não conecta na VPN. Erro 809.</div>
  <div class="steps"><span class="dot"></span>buscou na central · montou o chamado <span class="why">por quê?</span></div>
  <div class="bot">Prioridade alta. Um analista responde até as 13h.</div>
</div>
</body></html>`;

test("00 · prévia de link (Open Graph)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await context.newPage();
  await page.setContent(OG_HTML, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: "Service desk de TI, com o porquê à vista." })).toBeVisible();
  for (const name of ["opengraph-image", "twitter-image"]) await page.screenshot({ path: `src/app/${name}.png` });
  await context.close();
});

test("01 · login com SSO e demonstração", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar com Nexo SSO (teste)" })).toBeVisible();
  await shot(page, "01-login");
});

test("02 · chat da funcionária com o histórico", async ({ page }) => {
  // A Elisa tem conversa aberta no seed (Wi-Fi da sala 3); nenhum teste de documentação a altera.
  await login(page, ELISA);
  await page.waitForURL("**/atendimento");
  await expect(page.getByTestId("agent-reply").first()).toBeVisible();
  await shot(page, "02-chat-funcionaria");
});

test("03 · console do analista com a fila", async ({ page }) => {
  await login(page, RAFAEL);
  await page.waitForURL("**/console");
  await expect(page.getByRole("button", { name: /Bruno Tavares/ })).toBeVisible();
  // Espera a primeira conversa da fila abrir: sem isso a captura às vezes saía com "Carregando conversa…".
  await expect(page.getByRole("button", { name: "Assumir atendimento" })).toBeVisible();
  await shot(page, "03-console-fila");
});

test("04 · decisão do agent com a telemetria do turno", async ({ page }) => {
  // Janela alta: o painel inteiro cabe na área da conversa. Na altura normal a captura do elemento
  // saía cortada, com o rodapé da conversa por cima e um vazio embaixo.
  await page.setViewportSize({ width: 1440, height: 1600 });
  await login(page, RAFAEL);
  await page.getByRole("button", { name: /Bruno Tavares/ }).click();
  await page.getByRole("button", { name: "por quê?" }).click();
  const telemetry = page.getByTestId("turn-telemetry");
  await expect(telemetry.getByTestId("retrieval-details")).toBeVisible();
  await page.getByTestId("decision-details").scrollIntoViewIfNeeded();
  await page.getByTestId("decision-details").screenshot({ path: "docs/capturas/04-decisao-e-telemetria.png", animations: "disabled" });
});

test("05 · relatório da conversa", async ({ page }) => {
  await login(page, RAFAEL);
  await page.getByRole("button", { name: /Bruno Tavares/ }).click();
  await page.getByRole("button", { name: "Relatório" }).click();
  await expect(page.getByRole("region", { name: "Relatório da conversa" })).toBeVisible();
  await shot(page, "05-relatorio");
});

test("06 · indicadores do service desk", async ({ page }) => {
  await login(page, RAFAEL);
  await page.goto("/console/indicadores");
  await expect(page.getByRole("region", { name: "Principais indicadores" })).toBeVisible();
  await shot(page, "06-indicadores");
});

test("07 · métricas para o Prometheus", async ({ page, request }) => {
  const body = await (await request.get("/api/metrics", { headers: { Authorization: "Bearer e2e-metrics-token-e2e-metrics" } })).text();
  const lines = body.split("\n").filter((l) => l.startsWith("# HELP nexo_") && !l.includes("nexo_process") && !l.includes("nexo_nodejs")).slice(0, 14);
  expect(lines.length).toBeGreaterThan(8);
  await page.setContent(`<pre style="font: 13px/1.5 ui-monospace, Consolas, monospace; padding: 24px; background: #0f1b2d; color: #e6edf6; margin: 0; min-height: 100vh">GET /api/metrics (Authorization: Bearer …)\n\n${lines.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("\n")}</pre>`);
  await shot(page, "07-metricas-prometheus");
});

/**
 * Sem LLM: a conversa da Ana ganha uma troca de exemplo com o rascunho pendente (o mesmo formato
 * que o agent produz), para mostrar o cartão que a pessoa confirma.
 */
async function withDraftExample(page: Page) {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const view = (await response.json()) as ConversationView;
    const at = new Date().toISOString();
    view.draftStatuses = { ...view.draftStatuses, 900: "pending" };
    view.messages.push(
      { id: "doc-func", conversationId: view.id ?? "conv", role: "employee", authorName: null, text: "Meu monitor não liga desde hoje cedo. Tenho reunião com cliente às 15h.", cards: [], trace: null, createdAt: at } as never,
      {
        id: "doc-rascunho",
        conversationId: view.id ?? "conv",
        role: "agent",
        authorName: null,
        text: "Conferimos o cabo e a tomada e o monitor continua sem imagem. Montei o chamado: confira e confirme.",
        cards: [
          {
            kind: "draft",
            draft: {
              id: 900,
              kind: "create",
              status: "pending",
              deadline: at,
              fields: {
                type: "INC",
                category: "hardware",
                title: "Monitor não liga",
                description: "O monitor não liga desde hoje cedo. Cabo de energia e HDMI conferidos, sem imagem. Reunião com cliente às 15h.",
                impact: "me",
                priority: "high",
                priorityReason: "Impacto: somente você · urgência: compromisso hoje",
              },
            },
          },
        ],
        trace: null,
        createdAt: at,
      } as never,
    );
    await route.fulfill({ response, json: view });
  });
  await login(page, ANA);
  await expect(page.getByTestId("draft-card")).toBeVisible();
  await page.getByRole("button", { name: /Dispensar aviso/ }).first().click();
  await page.getByTestId("draft-card").scrollIntoViewIfNeeded();
}

test("08 · chat da funcionária com o rascunho de chamado", async ({ page }) => {
  await withDraftExample(page);
  await shot(page, "08-rascunho");
});

test("08b · detalhe da conversa com o rascunho, em alta resolução", async ({ browser }) => {
  // Para páginas e materiais em que a tela inteira ficaria pequena demais: só a conversa, em 2x.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await withDraftExample(page);
  await page.locator("main").first().screenshot({ path: "docs/capturas/08b-rascunho-detalhe.png" });
  await context.close();
});
