import { test, type Page } from "@playwright/test";
import { expect, login, RAFAEL } from "../e2e/helpers";

const ELISA = "elisa.prado@nexo.com.br";

/**
 * Percorre as telas principais e salva uma captura de cada em docs/capturas/. Antes de cada
 * captura, o teste confere o conteúdo: se a tela mudar, o teste falha em vez de documentar errado.
 */
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/capturas/${name}.png`, fullPage: false, animations: "disabled" });

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
  await shot(page, "03-console-fila");
});

test("04 · decisão do agent com a telemetria do turno", async ({ page }) => {
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
