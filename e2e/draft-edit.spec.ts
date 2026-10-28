import { test } from "@playwright/test";
import type { NewTicketFields } from "@/domain/message";
import { createDatabase } from "@/infrastructure/db/client";
import { conversations, drafts, messages } from "@/infrastructure/db/schema";
import { DIEGO, expect, login } from "./helpers";

/**
 * Sem LLM: um rascunho crítico de verdade é gravado no banco do E2E, como se o
 * agent o tivesse montado ("toda a empresa"). O Diego corrige pelo próprio card.
 */
const fields: NewTicketFields = {
  type: "INC",
  category: "hardware",
  title: "Monitores sem sinal",
  description: "Os monitores de vídeo não ligam desde hoje cedo, sem sinal.",
  impact: "company",
  urgency: "blocked",
  priority: "critical",
  priorityReason: "Impacto: toda a empresa · urgência: impede de trabalhar → Crítica",
};

test.beforeAll(async () => {
  const db = createDatabase("file:e2e.db", undefined);
  const now = new Date();
  await db.insert(conversations).values({ id: "conv-e2e-diego", employeeId: "emp-diego", status: "with_agent", createdAt: now, updatedAt: now });
  await db.insert(drafts).values({ id: 700, conversationId: "conv-e2e-diego", employeeId: "emp-diego", kind: "create", status: "pending", fields, createdAt: now });
  await db.insert(messages).values({
    id: "msg-e2e-diego",
    conversationId: "conv-e2e-diego",
    role: "agent",
    text: "Montei o rascunho. Confira e confirme.",
    cards: [{ kind: "draft", draft: { id: 700, kind: "create", status: "pending", fields, deadline: new Date(now.getTime() + 3_600_000).toISOString() } }],
    trace: null,
    createdAt: now,
  });
});

test("alterar detalhes no card recalcula a prioridade e troca o rascunho", async ({ page }) => {
  await login(page, DIEGO);
  await expect(page.getByText("Monitores sem sinal")).toBeVisible();

  await page.getByRole("button", { name: "Alterar detalhes" }).click();
  await page.getByRole("radiogroup", { name: "Afetados" }).getByRole("radio", { name: "Somente você" }).click();

  // Prévia ao vivo, antes de salvar.
  const preview = page.getByTestId("draft-preview");
  await expect(preview).toContainText("Alta");
  await expect(preview).toContainText("4 horas úteis");
  await expect(preview).toContainText("Afetados: Toda a empresa → Somente você · Prioridade: Crítica → Alta");

  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByText("Atualizei o rascunho: Afetados: Toda a empresa → Somente você · Prioridade: Crítica → Alta")).toBeVisible();
  await expect(page.getByText("Substituído")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Confirmar/ })).toBeEnabled();
});

test("voltar sem salvar não muda nada", async ({ page }) => {
  await login(page, DIEGO);
  const pendingCard = page.getByTestId("draft-card").filter({ hasText: "Aguardando confirmação" });
  await pendingCard.getByRole("button", { name: "Alterar detalhes" }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toBeDisabled(); // nada mudou ainda
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(pendingCard.getByRole("button", { name: /^Confirmar/ })).toBeVisible();
});
