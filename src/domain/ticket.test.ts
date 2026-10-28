import { describe, expect, it } from "vitest";
import { categoryForTitle, sameSubject } from "./ticket";

describe("programa de e-mail é categoria E-mail", () => {
  it.each([
    ["Outlook não abre desde a atualização", "software", "email"],
    ["Webmail fora do ar", "software", "email"],
    ["Caixa de entrada não recebe mensagens", "software", "email"],
    ["Thunderbird travando", "other", "email"],
    ["Instalar o Power BI Desktop", "software", "software"],
    ["VPN não conecta — erro 809", "network", "network"],
    // Só Software/Outros são corrigidos: Acesso ao e-mail (senha) continua Acesso.
    ["Senha do e-mail bloqueada", "access", "access"],
  ] as const)("%s (%s) → %s", (title, category, expected) => {
    expect(categoryForTitle(title, category)).toBe(expected);
  });
});

describe("mesmo assunto do chamado existente", () => {
  it("categoria diferente é outro problema: E-mail não complementa Hardware", () => {
    expect(sameSubject("hardware", "email")).toBe(false);
    expect(sameSubject("access", "network")).toBe(false);
  });

  it("mesma categoria, ou Hardware e Software (o sintoma de um aparece no outro)", () => {
    expect(sameSubject("access", "access")).toBe(true);
    expect(sameSubject("hardware", "software")).toBe(true);
    expect(sameSubject("software", "hardware")).toBe(true);
  });
});
