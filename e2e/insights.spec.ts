import { test } from "@playwright/test";
import { expect, login, RAFAEL } from "./helpers";

test("analista abre os indicadores pelo console", async ({ page }) => {
  await login(page, RAFAEL);
  await page.getByRole("link", { name: "Indicadores" }).click();
  await expect(page.getByRole("heading", { name: "Indicadores" })).toBeVisible();

  const main = page.getByRole("region", { name: "Principais indicadores" });
  await expect(main.getByText("Resolvido pelo agent")).toBeVisible();
  // O valor depende do que os outros testes já fizeram no banco; aqui basta ser uma porcentagem.
  await expect(main.getByText(/^\d+%$/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Mais indicadores" }).getByText("Analistas no service desk")).toBeVisible();

  const handoffs = page.getByRole("region", { name: "Transferências por motivo" });
  await expect(handoffs.getByText("Funcionário pediu um analista")).toBeVisible();
  await expect(handoffs.getByText("Agent sem segurança para decidir")).toBeVisible();

  // Resolução honesta: os grupos e as definições, que abrem pelo teclado.
  const resolution = page.getByRole("region", { name: "Resolução honesta" });
  for (const label of ["Confirmadas", "Presumidas", "Viraram chamado", "Reabertas", "Abandonadas", "Com analista"]) {
    await expect(resolution.getByRole("listitem").filter({ hasText: label })).toBeVisible();
  }
  await resolution.getByText("Como contamos").focus();
  await page.keyboard.press("Enter");
  await expect(resolution.getByText(/voltou com o mesmo assunto em até 7 dias/)).toBeVisible();

  // Lacunas: as 3 buscas do seed sobre a impressora do 3º andar, sem artigo; o CPF do exemplo não aparece.
  const gaps = page.getByRole("region", { name: "Lacunas da central" });
  await expect(gaps.getByText("impressora, andar")).toBeVisible();
  await expect(gaps.getByText(/3 buscas sem artigo · 100% viraram chamado ou analista/)).toBeVisible();
  await expect(page.getByText(/123.456.789-09/)).toHaveCount(0);

  await page.getByRole("link", { name: "Conversas" }).click();
  await expect(page.getByText("Conversas", { exact: true }).first()).toBeVisible();
});

test("funcionário não abre os indicadores", async ({ page }) => {
  await login(page, "ana.souza@nexo.com.br");
  await page.goto("/console/indicadores");
  await expect(page).toHaveURL(/\/atendimento/);
});

test("o login mostra números deste ambiente, não os do protótipo", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("analistas no service desk")).toBeVisible();
  await expect(page.getByText("6", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Números deste ambiente nos últimos 30 dias.")).toBeVisible();
});
