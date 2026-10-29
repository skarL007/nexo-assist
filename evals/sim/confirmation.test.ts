import { describe, expect, it } from "vitest";
import { LOOKS_LIKE_CONFIRMATION } from "./checks";

describe("oráculo de consentimento do funcionário simulado", () => {
  it.each(["Pode me explicar o prazo", "Sim, só eu fui afetada", "Ok, entendi o prazo"])("não trata %s como consentimento", (text) => {
    expect(LOOKS_LIKE_CONFIRMATION.test(text)).toBe(false);
  });
  it.each(["Sim", "Pode criar o chamado", "Confirmo", "Sim, pode reabrir"])("aceita %s", (text) => {
    expect(LOOKS_LIKE_CONFIRMATION.test(text)).toBe(true);
  });
});
