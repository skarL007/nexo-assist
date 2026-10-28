import { test } from "@playwright/test";
import { ANA, expect, login, RAFAEL } from "./helpers";

/**
 * Aviso proativo de prazo, sem LLM. No seed, o INC-20311 da Ana (prioridade média,
 * 3 dias úteis) foi atualizado há 6 dias: está vencido em qualquer dia em que o teste rodar.
 */
test("a funcionária abre o chat e vê o chamado vencido, com o porquê e o atalho para um analista", async ({ page }) => {
  let sent = "";
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent = (route.request().postDataJSON() as { text: string }).text;
    await route.abort(); // não chama o modelo: só confere o que seria enviado
  });
  await login(page, ANA);

  const banner = page.getByRole("region", { name: "Prazos dos seus chamados" });
  await expect(banner.getByText(/INC-20311 venceu o prazo há/)).toBeVisible();
  await banner.getByRole("button", { name: /por quê/ }).first().click();
  await expect(banner.getByText(/Prioridade Média: resposta em até 3 dias úteis/)).toBeVisible();

  await banner.getByRole("button", { name: "Falar com um analista" }).first().click();
  await expect.poll(() => sent).toContain("INC-20311");

  await page.unroute("**/api/chat");
  await page.reload();
  await banner.getByRole("button", { name: "Dispensar aviso do INC-20311" }).click();
  await expect(banner.getByText(/INC-20311 venceu/)).toHaveCount(0);
});

test("o analista vê a fila de prazos em risco, com a conta do prazo", async ({ page }) => {
  await login(page, RAFAEL);
  await page.goto("/console/indicadores");
  const queue = page.getByRole("region", { name: "Prazos em risco agora" });
  await expect(queue.getByText(/INC-20311 venceu o prazo há/)).toBeVisible();
  await expect(queue.getByText(/Ana Souza/)).toBeVisible();
  await queue.getByText(/INC-20311 venceu o prazo há/).click();
  await expect(queue.getByText(/O relógio ficou parado \d+ h fora do expediente/).first()).toBeVisible();
});
