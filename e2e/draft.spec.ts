import { test, type Page } from "@playwright/test";
import type { ConversationView } from "@/contracts/chat";
import { ANA, expect, login } from "./helpers";

/**
 * Sem LLM: a resposta do servidor ganha um rascunho pendente, e o envio da
 * mensagem fica segurado para simular o Nexo respondendo. Confirmar no meio
 * da resposta deixava a resposta desatualizada ("o rascunho ainda está pronto").
 */
async function withPendingDraft(page: Page) {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "GET") return; // POST segurado: o Nexo "está respondendo"
    const response = await route.fetch();
    const view = (await response.json()) as ConversationView;
    view.draftStatuses = { ...view.draftStatuses, 900: "pending" };
    view.messages.push({
      id: "msg-rascunho",
      conversationId: view.id ?? "conv",
      role: "agent",
      authorName: null,
      text: "Montei o rascunho. Confira e confirme.",
      cards: [
        {
          kind: "draft",
          draft: {
            id: 900,
            kind: "create",
            status: "pending",
            deadline: new Date().toISOString(),
            fields: {
              type: "INC",
              category: "hardware",
              title: "Tela não está ligando",
              description: "O monitor não liga desde hoje cedo.",
              impact: "me",
              priority: "high",
              priorityReason: "Impacto: somente você · urgência: compromisso hoje",
            },
          },
        },
      ],
      trace: null,
      createdAt: new Date().toISOString(),
    });
    await route.fulfill({ response, json: view });
  });
}

test("rascunho fica travado enquanto o Nexo responde", async ({ page }) => {
  await withPendingDraft(page);
  await login(page, ANA);
  const confirm = page.getByRole("button", { name: /^Confirmar/ });
  await expect(confirm).toBeEnabled();

  await page.locator("footer textarea").fill("Esqueci de dizer: é o monitor da direita.");
  await page.keyboard.press("Enter");

  await expect(confirm).toBeDisabled();
  await expect(page.getByText("Aguarde o Nexo responder para confirmar.")).toBeVisible();
});

test("erro ao confirmar aparece no próprio card (não escondido no fim da página)", async ({ page }) => {
  await withPendingDraft(page);
  await page.route("**/api/chat/drafts/900", (route) =>
    route.fulfill({ status: 503, json: { error: "O sistema de chamados está indisponível no momento.", code: "legacy_unavailable" } }),
  );
  await login(page, ANA);
  await page.getByRole("button", { name: /^Confirmar/ }).click();
  const alert = page.getByTestId("draft-card").getByRole("alert");
  await expect(alert).toHaveText("O sistema de chamados está indisponível no momento.");
  await expect(alert).toBeInViewport();
});
