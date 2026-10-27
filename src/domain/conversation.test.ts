import { describe, expect, it } from "vitest";
import { agentCanReply, nextStatus } from "./conversation";
import { DomainError } from "./errors";

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
