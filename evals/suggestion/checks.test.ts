import { describe, expect, it } from "vitest";
import { checkSuggestion } from "./checks";

const carla = { name: "Carla", conversationId: "conv-carla", firstName: "Carla", topic: ["SAP"] };
const context = "Carla precisa de perfil de aprovação no SAP (INC-20320).";

describe("checagens da sugestão de resposta", () => {
  it("boa sugestão passa", () => {
    expect(checkSuggestion("Oi, Carla! Vou verificar seu perfil de aprovação no SAP (INC-20320). Qual transação dá erro?", context, carla)).toEqual([]);
  });

  it("pega número inventado, ação que ninguém fez, nome e assunto", () => {
    expect(checkSuggestion("Olá! Liberei seu acesso e abri o REQ-99999.", context, carla)).toEqual([
      "inventou REQ-99999",
      "não chamou Carla pelo nome",
      "fugiu do assunto (SAP)",
      'afirmou ação que ninguém fez ("Liberei")',
    ]);
  });
});
