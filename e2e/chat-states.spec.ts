import { test } from "@playwright/test";
import { ANA, CARLA, expect, login } from "./helpers";

/**
 * Estados do campo de mensagem e da espera, sem LLM (docs/specs/06-layout-responsivo.md).
 * A conversa da Carla (seed) espera um analista; o envio da Ana é interceptado.
 */
test("esperando um analista, o campo diz que a mensagem vai para o analista", async ({ page }) => {
  await login(page, CARLA);
  await expect(page.getByRole("status").filter({ hasText: "Um analista vai continuar por aqui" })).toBeVisible();
  await expect(page.locator("footer textarea")).toHaveAttribute("placeholder", "Escreva para o analista…");
});

test("depois de enviar, o Farol aparece pensando antes de o servidor responder", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 1500)); // o servidor ainda não mandou nada
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "error", message: "Sem resposta do modelo." }) + "\n" });
  });
  await login(page, ANA);
  await expect(page.locator("footer textarea")).toHaveAttribute("placeholder", "Escreva para o Farol…");
  await page.locator("footer textarea").fill("Minha VPN dá erro 809");
  await page.keyboard.press("Enter");

  await expect(page.getByText("pensando…")).toBeVisible();
  await expect(page.getByText("Sem resposta do modelo.")).toBeVisible();
  await expect(page.getByText("pensando…")).toHaveCount(0);
});
