import { describe, expect, it } from "vitest";
import { suggestionOutcome, unknownTicketCodes } from "./reply-suggestion";

describe("sugestão de resposta: regras em código", () => {
  it("aponta número de chamado que o modelo inventou (não está no contexto)", () => {
    const context = "Carla precisa de perfil no SAP (INC-20320).";
    expect(unknownTicketCodes("Oi, Carla! Liberei o acesso do INC-20320 e abri o REQ-99999.", context)).toEqual(["REQ-99999"]);
    expect(unknownTicketCodes("Oi, Carla! Já vou olhar o INC-20320.", context)).toEqual([]);
  });

  it("enviou igual ou editou", () => {
    expect(suggestionOutcome("Oi, Carla!", "  Oi, Carla! ")).toBe("sent_as_is");
    expect(suggestionOutcome("Oi, Carla!", "Oi, Carla! Pode testar?")).toBe("sent_edited");
  });
});
