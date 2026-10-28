import { test } from "@playwright/test";
import { CARLA, expect, login, RAFAEL } from "./helpers";

/**
 * Frustração sem LLM: no seed, o último entendimento da Carla registrou frustração alta.
 * O analista vê o chip (texto), a Carla no topo da fila e o motivo no relatório;
 * a própria Carla nunca vê o rótulo.
 */
test("analista vê 'Frustração alta' na fila, primeiro entre as que esperam, e o motivo no relatório", async ({ page }) => {
  await login(page, RAFAEL);
  const queue = page.getByRole("button", { name: /Carla Mendes|Bruno Tavares/ });
  await expect(queue.first()).toContainText("Carla Mendes");
  await expect(queue.first()).toContainText("Frustração alta");

  await queue.first().click();
  await page.getByRole("button", { name: "Relatório" }).click();
  await expect(page.getByText("Frustração alta: urgente: precisa fechar pedidos hoje e o acesso ainda não saiu")).toBeVisible();
});

test("a funcionária não vê o rótulo de frustração", async ({ page }) => {
  await login(page, CARLA);
  await expect(page.getByText("Chamei um analista para você, Carla.")).toBeVisible();
  await expect(page.getByText(/Frustração/)).toHaveCount(0);
});
