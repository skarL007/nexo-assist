import { describe, expect, it } from "vitest";
import { needsContinuation, stepPolicy } from "./step-policy";

describe("stepPolicy", () => {
  it("no passo 0, obriga o registro do que o modelo entendeu", () => {
    expect(stepPolicy(0, false)).toEqual({ toolChoice: { type: "tool", toolName: "recordUnderstanding" } });
  });

  it("depois do passo 0, tira recordUnderstanding para o modelo não repetir o registro", () => {
    const { activeTools } = stepPolicy(1, false);
    expect(activeTools).not.toContain("recordUnderstanding");
    expect(activeTools).toEqual(expect.arrayContaining(["listMyTickets", "draftNewTicket", "confirmDraft", "transferToAnalyst"]));
  });

  it("no turno de esclarecimento (baixa confiança), só pode oferecer respostas rápidas: nada de rascunho, confirmação ou transferência", () => {
    expect(stepPolicy(1, false, true)).toEqual({ activeTools: ["offerQuickReplies"] });
  });

  it("depois de transferir para um analista, não chama mais tools", () => {
    expect(stepPolicy(2, true)).toEqual({ toolChoice: "none" });
  });
});

describe("needsContinuation", () => {
  const understanding = { tool: "recordUnderstanding", input: {}, output: { ok: true }, durationMs: 1 };
  const action = { tool: "listMyTickets", input: {}, output: {}, durationMs: 1 };

  it("continua quando o turno parou só no registro, sem texto (Gemini repetiu a tool até o limite)", () => {
    expect(needsContinuation({ reply: "", handedOff: false, toolCalls: [understanding, understanding, understanding] })).toBe(true);
  });

  it("não continua quando já houve resposta, ação ou transferência", () => {
    expect(needsContinuation({ reply: "Posso ajudar?", handedOff: false, toolCalls: [understanding] })).toBe(false);
    expect(needsContinuation({ reply: "", handedOff: false, toolCalls: [understanding, action] })).toBe(false);
    expect(needsContinuation({ reply: "", handedOff: true, toolCalls: [understanding] })).toBe(false);
  });
});
