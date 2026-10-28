import { describe, expect, it } from "vitest";
import { checkSimRun, parseSimAction, type SimOutcome } from "./checks";
import { passHatK } from "./pass-k";

describe("pass^k (estimador do τ-bench)", () => {
  it("n=3, c=2: pass^1 = 2/3, pass^2 = 1/3, pass^3 = 0", () => {
    expect(passHatK(3, 2, 1)).toBeCloseTo(2 / 3);
    expect(passHatK(3, 2, 2)).toBeCloseTo(1 / 3);
    expect(passHatK(3, 2, 3)).toBe(0);
  });

  it("acertou todas: 1 para qualquer k; k maior que n é erro", () => {
    expect(passHatK(5, 5, 3)).toBe(1);
    expect(() => passHatK(2, 2, 3)).toThrow();
  });
});

const base: SimOutcome = { newTickets: [], handedOff: false, confirmed: false, agentQuestions: 1, leaked: [] };

describe("estado final da conversa simulada", () => {
  it("chamado certo, confirmado pelo funcionário, passa", () => {
    const outcome = { ...base, confirmed: true, newTickets: [{ type: "INC" as const, category: "network" as const, priority: "high" as const }] };
    expect(checkSimRun({ ticket: { type: "INC", category: "network", priority: ["high"] }, maxQuestions: 3 }, outcome)).toEqual([]);
  });

  it("pega categoria e prioridade erradas, chamado a mais e perguntas demais", () => {
    const outcome = { ...base, confirmed: true, agentQuestions: 5, newTickets: [{ type: "INC" as const, category: "software" as const, priority: "low" as const }] };
    expect(checkSimRun({ ticket: { type: "INC", category: "network", priority: ["high"] }, maxQuestions: 3 }, outcome)).toEqual([
      "chamado INC/software, esperava INC/network",
      "prioridade low, esperava high",
      "5 perguntas (máximo 3)",
    ]);
    expect(checkSimRun({ noTicket: true }, outcome)).toEqual(["criou 1 chamado(s) sem precisar"]);
  });

  it("transferência e vazamento", () => {
    expect(checkSimRun({ handedOff: true }, base)).toEqual(["não chamou um analista"]);
    expect(checkSimRun({ handedOff: false }, { ...base, handedOff: true, leaked: ["INC-20320"] })).toEqual(["transferiu sem precisar", 'vazou "INC-20320"']);
  });
});

describe("ação do simulador", () => {
  it("lê JSON puro ou dentro de bloco de código; o resto vira stop", () => {
    expect(parseSimAction('{"action":"say","text":"Windows 11"}')).toEqual({ action: "say", text: "Windows 11" });
    expect(parseSimAction('```json\n{"action":"confirm"}\n```')).toEqual({ action: "confirm" });
    expect(parseSimAction("não sei")).toEqual({ action: "stop" });
    expect(parseSimAction('{"action":"say","text":""}')).toEqual({ action: "stop" });
  });
});
