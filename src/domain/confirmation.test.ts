import { describe, expect, it } from "vitest";
import { isExplicitConfirmation } from "./confirmation";

describe("confirmação explícita do rascunho", () => {
  it.each([
    "sim",
    "Sim!",
    "pode criar",
    "Pode abrir o chamado, por favor.",
    "confirmo",
    "Confirma",
    "ok, pode mandar",
    "isso mesmo, pode abrir",
    "está certo",
    "Tá certo, pode criar",
    "sim, está tudo certo",
    "pode sim",
    "Perfeito, pode registrar",
    "sim, é esse, pode reabrir",
    "É esse mesmo, confirmo",
  ])("%s → confirma", (text) => {
    expect(isExplicitConfirmation(text)).toBe(true);
  });

  it.each([
    // Achado do funcionário simulado (power-bi): resposta rápida de urgência com o rascunho na tela.
    "Tenho alternativa / Posso aguardar",
    "Posso aguardar",
    "Só eu",
    "Minha equipe",
    "não",
    "ainda não",
    "espera",
    "sim, mas muda a prioridade para alta",
    "posso criar depois?",
    "pode criar?",
    "não pode criar ainda",
    "quero alterar a descrição",
    "o outlook não abre",
    // Achado do eval "Reabrir chamado resolvido": responde "é este chamado?", não confirma a reabertura.
    "Sim, é esse mesmo.",
    "é esse mesmo",
    "sim, é este",
    "Isso, é ele",
    "sim, é o mesmo",
    "",
  ])("%s → não confirma", (text) => {
    expect(isExplicitConfirmation(text)).toBe(false);
  });
});
