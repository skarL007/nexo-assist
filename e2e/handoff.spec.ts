import { test } from "@playwright/test";
import { CARLA, expect, login, logout, RAFAEL } from "./helpers";

/**
 * Ciclo completo da transferência, sem LLM (a conversa da Carla já vem
 * transferida no seed): analista assume, responde, devolve ao agent,
 * e a Carla vê a resposta no chat dela.
 */
test("analista assume, responde e devolve a conversa ao agent", async ({ page }) => {
  await login(page, RAFAEL);
  await page.getByRole("button", { name: /Carla Mendes/ }).click();
  await expect(page.getByText("Resumo da transferência")).toBeVisible();
  await expect(page.getByText(/Carla espera um atendente/)).toBeVisible();

  await page.getByRole("button", { name: "Assumir atendimento" }).click();
  await expect(page.getByText(/Rafael Lima assumiu/)).toBeVisible();

  await page.getByLabel("Resposta do analista").fill("Oi, Carla! Liberei o perfil no SAP, pode testar?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Oi, Carla! Liberei o perfil no SAP, pode testar?")).toBeVisible();

  // A Carla vê o analista no chat dela, com o agent pausado.
  await logout(page);
  await login(page, CARLA);
  await expect(page.getByText("Oi, Carla! Liberei o perfil no SAP, pode testar?")).toBeVisible();
  await expect(page.getByText("Rafael Lima está atendendo você agora.")).toBeVisible();

  // O analista devolve; o chat volta para o agent.
  await logout(page);
  await login(page, RAFAEL);
  await page.getByRole("tab", { name: /Minhas/ }).click();
  await page.getByRole("button", { name: /Carla Mendes/ }).click();
  await page.getByRole("button", { name: "Devolver ao agent" }).click();
  await expect(page.getByText(/devolveu a conversa ao Nexo Assist/)).toBeVisible();
});
