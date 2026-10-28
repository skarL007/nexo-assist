import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Relatório da conversa no console, sem LLM. Usa a conversa do Bruno (seed), que nenhum
 * outro teste muda: a da Carla é assumida e devolvida em handoff.spec.ts.
 */
test("analista abre o relatório da conversa e copia em texto", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, RAFAEL);
  await page.getByRole("button", { name: /Bruno Tavares/ }).click();
  await page.getByRole("button", { name: "Relatório" }).click();

  const report = page.getByRole("region", { name: "Relatório da conversa" });
  await expect(report.getByText(/plugin de IA no Figma/)).toBeVisible();
  await expect(report.getByText(/Agent sem segurança para decidir · confiança 41%/)).toBeVisible();
  await expect(report.getByText(/Bruno espera um atendente desde/)).toBeVisible();

  await report.getByRole("button", { name: "Copiar" }).click();
  await expect(report.getByRole("button", { name: "Copiado" })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Relatório da conversa · Bruno Tavares (Marketing)");
  // No Windows, a área de transferência devolve as quebras de linha como \r\n.
  expect(text).toMatch(/Pendências:\r?\n- Bruno espera um atendente desde/);

  await report.getByRole("button", { name: "Fechar relatório" }).click();
  await expect(page.getByText("Resumo da transferência")).toBeVisible();
});
