import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

/**
 * Achado do vídeo de 02/11: com a conversa no agent, o chat do funcionário não abria o stream;
 * quando o analista assumia, a tela só mudava ao recarregar. Agora o stream fica aberto com
 * qualquer conversa aberta, e a tomada aparece sozinha. Sem LLM.
 */
const ELISA = "elisa.prado@nexo.com.br";
const CONVERSATION = "conv-elisa";

test("analista assume uma conversa que estava com o agent: o chat do funcionário muda sem recarregar", async ({ page, browser }) => {
  const rafael = await browser.newPage();
  await login(rafael, RAFAEL);
  await rafael.waitForURL("**/console");
  const origin = new URL(rafael.url()).origin;
  const act = (action: "assume" | "release") =>
    rafael.request.post(`/api/console/conversations/${CONVERSATION}`, { data: { action }, headers: { Origin: origin } });

  // Começa com o agent.
  await act("assume");
  expect((await act("release")).ok()).toBe(true);

  await login(page, ELISA);
  await page.waitForURL("**/atendimento");
  await expect(page.getByLabel("Mensagem")).toBeEnabled();
  const notice = page.getByText("Rafael Lima está atendendo você agora.");
  await expect(notice).toHaveCount(0);

  expect((await act("assume")).ok()).toBe(true);
  // Sem reload: chega pelo stream (ou, se ele cair, pelo polling), em poucos segundos.
  await expect(notice).toBeVisible({ timeout: 6000 });

  await act("release");
  await rafael.close();
});
