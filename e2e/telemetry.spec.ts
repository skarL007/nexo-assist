import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Telemetria do turno no console, sem LLM: o turno do Bruno (seed) tem o id do trace, o tempo
 * de cada ferramenta e o raio-X da busca. O report.spec.ts usa a mesma conversa só para leitura.
 */
test("analista vê a telemetria do turno: id do trace, tempo das ferramentas e raio-X da busca", async ({ page }) => {
  await login(page, RAFAEL);
  await page.getByRole("button", { name: /Bruno Tavares/ }).click();
  await page.getByRole("button", { name: "por quê?" }).click();

  const telemetry = page.getByTestId("turn-telemetry");
  await expect(telemetry.getByText("4bf92f3577b34da6a3ce929d0e0e4736")).toBeVisible();

  const timings = telemetry.getByRole("list", { name: "Tempo de cada ferramenta" });
  await expect(timings.getByRole("listitem")).toHaveCount(3);
  await expect(timings.getByText("1480 ms")).toBeVisible();

  const search = telemetry.getByTestId("retrieval-details");
  await expect(search.getByText("“instalar plugin de IA no Figma”")).toBeVisible();
  await expect(search.getByText("Híbrida · google/gemini-embedding-2")).toBeVisible();
  await expect(search.getByText("Avaliador google/gemini-3.5-flash-lite: talvez")).toBeVisible();
  const rows = search.getByRole("row");
  await expect(rows).toHaveCount(4); // cabeçalho + 3 candidatos
  await expect(rows.nth(1)).toContainText("Instalar ou solicitar software");
  await expect(rows.nth(1)).toContainText("0,66");
  await expect(rows.nth(1).getByLabel("devolvido ao agent")).toBeVisible();
});
