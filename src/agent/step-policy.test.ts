import { describe, expect, it } from "vitest";
import { stepPolicy } from "./step-policy";

describe("stepPolicy", () => {
  it("no passo 0, obriga o registro do que o modelo entendeu", () => {
    expect(stepPolicy(0, false)).toEqual({ toolChoice: { type: "tool", toolName: "recordUnderstanding" } });
  });

  it("depois do passo 0, tira recordUnderstanding para o modelo não repetir o registro", () => {
    const { activeTools } = stepPolicy(1, false);
    expect(activeTools).not.toContain("recordUnderstanding");
    expect(activeTools).toEqual(expect.arrayContaining(["listMyTickets", "draftNewTicket", "confirmDraft", "transferToAnalyst"]));
  });

  it("depois de transferir para um analista, não chama mais tools", () => {
    expect(stepPolicy(2, true)).toEqual({ toolChoice: "none" });
  });
});
