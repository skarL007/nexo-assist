import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Sugestão de resposta sem LLM: a rota da sugestão é interceptada com um texto fixo
 * (com um número de chamado que não existe, para ver o aviso). O envio é de verdade
 * e leva o texto sugerido, para o servidor medir se foi editado.
 * Usa a conversa da Elisa e devolve ao agent no fim (o feedback.spec precisa dela com o agent).
 */
test("analista pede uma sugestão, revisa o aviso, edita e envia", async ({ page }) => {
  await page.route("**/api/console/conversations/*/suggestion", (route) =>
    route.fulfill({
      json: {
        text: "Oi, Elisa! Vou olhar o Wi-Fi da sala 3 (INC-20319) e o REQ-99999.",
        warnings: ["Cita o REQ-99999, que não aparece na conversa: confira antes de enviar."],
      },
    }),
  );
  let sentBody: { text?: string; suggested?: string } = {};
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/messages")) sentBody = request.postDataJSON() as typeof sentBody;
  });

  await login(page, RAFAEL);
  await page.getByRole("tab", { name: /^Todas/ }).click();
  await page.getByRole("button", { name: /Elisa Prado/ }).click();
  await page.getByRole("button", { name: "Assumir atendimento" }).click();

  await page.getByRole("button", { name: "Sugerir resposta" }).click();
  const field = page.getByLabel("Resposta do analista");
  await expect(field).toHaveValue(/Oi, Elisa! Vou olhar o Wi-Fi da sala 3/);
  await expect(page.getByRole("alert").filter({ hasText: "REQ-99999" })).toBeVisible();
  await expect(page.getByText("Sugestão do Nexo: revise antes de enviar.")).toBeVisible();

  // O analista corrige o número inventado antes de enviar.
  await field.fill("Oi, Elisa! Vou olhar o Wi-Fi da sala 3 (INC-20319). Volto em instantes.");
  await page.getByRole("button", { name: "Enviar" }).click();
  // .first(): a mensagem também aparece como prévia na lista de conversas.
  await expect(page.getByText("Oi, Elisa! Vou olhar o Wi-Fi da sala 3 (INC-20319). Volto em instantes.").first()).toBeVisible();
  expect(sentBody.suggested).toContain("REQ-99999");
  expect(sentBody.text).not.toContain("REQ-99999");

  await page.getByRole("button", { name: "Devolver ao agent" }).click();
  await expect(page.getByText(/devolveu a conversa ao Nexo Assist/).first()).toBeVisible();

  // O uso da sugestão aparece nos indicadores (enviada editada).
  await page.goto("/console/indicadores");
  await expect(page.getByText(/1 editadas/)).toBeVisible();
});

test("analista que não assumiu a conversa não pede sugestão", async ({ page }) => {
  await login(page, RAFAEL);
  // Espera o login terminar: o page.request não espera a tela, e sem o cookie a rota responde 401.
  await expect(page).toHaveURL(/\/console$/);
  const response = await page.request.post("/api/console/conversations/conv-bruno/suggestion", { headers: { Origin: new URL(page.url()).origin } });
  expect(response.status()).toBe(403);
});
