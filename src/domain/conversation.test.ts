import { describe, expect, it } from "vitest";
import { agentCanReply, agentReplyStillValid, nextStatus, shouldHandOffForLowConfidence } from "./conversation";
import { DomainError } from "./errors";

describe("resposta do agent no fim do turno", () => {
  // Auditoria de 02/11 (P1): o estado é lido no início; um analista pode assumir durante a inferência.
  it("só publica se a conversa ainda está com o agent", () => {
    expect(agentReplyStillValid("with_agent", false)).toBe(true);
    expect(agentReplyStillValid("with_analyst", false)).toBe(false);
    expect(agentReplyStillValid("waiting_analyst", false)).toBe(false);
    expect(agentReplyStillValid("closed", false)).toBe(false);
  });

  it("se o próprio turno transferiu, publica o aviso, mesmo que o analista já tenha assumido", () => {
    expect(agentReplyStillValid("waiting_analyst", true)).toBe(true);
    expect(agentReplyStillValid("with_analyst", true)).toBe(true);
    expect(agentReplyStillValid("closed", true)).toBe(false);
  });
});

describe("máquina de estados da conversa", () => {
  it("transferir pausa o agent", () => {
    const status = nextStatus("with_agent", "handoff");
    expect(status).toBe("waiting_analyst");
    expect(agentCanReply(status)).toBe(false);
  });

  it("analista assume e depois devolve ao agent", () => {
    const assumed = nextStatus("waiting_analyst", "assume");
    expect(assumed).toBe("with_analyst");
    expect(nextStatus(assumed, "release")).toBe("with_agent");
  });

  it("não deixa encerrar duas vezes", () => {
    expect(() => nextStatus("closed", "close")).toThrow(DomainError);
  });

  it("não transfere de novo uma conversa que já está com analista", () => {
    expect(() => nextStatus("with_analyst", "handoff")).toThrow(DomainError);
  });
});

describe("baixa confiança: pergunta antes de transferir", () => {
  it("na primeira dúvida, pergunta em vez de chamar um analista", () => {
    // Achado da auditoria: "não funciona" ia direto para um analista, e o complemento ficava sem resposta.
    expect(shouldHandOffForLowConfidence({ intent: "unclear", confidence: 0.3 }, null)).toBe(false);
    expect(shouldHandOffForLowConfidence({ intent: "unclear", confidence: 0.3 }, { confidence: 0.9 })).toBe(false);
  });

  it("se continuar sem segurança depois de perguntar, transfere", () => {
    expect(shouldHandOffForLowConfidence({ intent: "unclear", confidence: 0.3 }, { confidence: 0.35 })).toBe(true);
  });

  it("com segurança ou num cumprimento, nunca transfere por isso", () => {
    expect(shouldHandOffForLowConfidence({ intent: "new_ticket", confidence: 0.8 }, { confidence: 0.2 })).toBe(false);
    expect(shouldHandOffForLowConfidence({ intent: "greeting", confidence: 0.2 }, { confidence: 0.2 })).toBe(false);
  });
});
