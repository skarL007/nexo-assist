import { test, type Page } from "@playwright/test";
import type { ConversationView } from "@/contracts/chat";
import { expect, login, logout, RAFAEL } from "./helpers";

const ELISA = "elisa.prado@nexo.com.br";
const REPLY_ID = "conv-elisa-m1"; // resposta do agent no seed da Elisa

/**
 * Sem LLM: a resposta do agent do seed ganha um trace (as respostas reais sempre têm),
 * e a avaliação vai de verdade para o servidor e aparece para o analista.
 */
async function withTracedReply(page: Page) {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const view = (await (await route.fetch()).json()) as ConversationView;
    const reply = view.messages.find((m) => m.id === REPLY_ID);
    if (reply) {
      reply.trace = {
        decision: { intent: "ticket_status", understanding: "Wi-Fi da sala 3 caiu de novo", confidence: 0.9, reasoning: "" },
        steps: [{ label: "consultou o INC-20319", ok: true }],
        toolCalls: [],
        guardrails: [],
        model: "google/gemini-3.5-flash",
        usage: { inputTokens: 2000, outputTokens: 80 },
        latencyMs: 2100,
      };
    }
    await route.fulfill({ json: view });
  });
}

test('"Isso resolveu?": o funcionário avalia, a avaliação fica gravada e o analista vê', async ({ page }) => {
  await withTracedReply(page);
  await login(page, ELISA);

  const prompt = page.getByRole("group", { name: "Isso resolveu?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Não" }).click();
  await expect(page.getByRole("button", { name: "Falar com um analista" })).toBeVisible();

  // Volta atrás: vale a última avaliação.
  await page.getByRole("button", { name: "Na verdade, resolveu" }).click();
  await expect(page.getByText("Obrigado pelo retorno!")).toBeVisible();

  // Gravado no servidor: recarregar mantém a avaliação.
  await page.reload();
  await expect(page.getByText("Obrigado pelo retorno!")).toBeVisible();

  await logout(page);
  await page.unroute("**/api/chat");
  await login(page, RAFAEL);
  await page.getByRole("tab", { name: /^Todas/ }).click();
  await page.getByRole("button", { name: /Elisa Prado/ }).click();
  await expect(page.getByText("Funcionário: resolveu")).toBeVisible();
});

test("não dá para avaliar a resposta de outra pessoa", async ({ page }) => {
  await login(page, ELISA);
  // Espera o login terminar: o page.request não espera a tela, e sem o cookie a rota responde 401.
  await expect(page).toHaveURL(/\/atendimento$/);
  const response = await page.request.post("/api/chat/feedback", {
    data: { messageId: "conv-carla-m1", helpful: false },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(404);
});
