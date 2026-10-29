import { describe, expect, it } from "vitest";
import type { Decision } from "@/domain/message";
import { TurnRecorder } from "./turn-context";

const decision = (understanding: string): Decision => ({ intent: "question", understanding, confidence: 0.9, reasoning: "" });

describe("registro do entendimento", () => {
  it("vale só o primeiro do turno; os repetidos (chamadas paralelas do modelo) são contados e ignorados", () => {
    const recorder = new TurnRecorder();
    expect(recorder.recordDecision(decision("primeiro"))).toBe(true);
    expect(recorder.recordDecision(decision("segundo"))).toBe(false);
    expect(recorder.recordDecision(decision("terceiro"))).toBe(false);
    expect(recorder.decision?.understanding).toBe("primeiro");
    expect(recorder.repeatedUnderstandings).toBe(2);
  });
});

describe("oferta de analista no fim do turno", () => {
  const replies = (recorder: TurnRecorder) => recorder.cards.flatMap((c) => (c.kind === "quick_replies" ? c.options : []));

  it("prazo não atende a necessidade: o código põe o botão de analista", () => {
    const recorder = new TurnRecorder();
    recorder.offerAnalyst = true;
    recorder.finishAnalystOffer();
    expect(replies(recorder)).toEqual(["Falar com um analista"]);
  });

  it("prazo atende a necessidade: o botão de analista sai das respostas rápidas e o trace explica", () => {
    // Achado do funcionário simulado (vpn-reuniao): o chamado já atendia e o agent ofereceu analista mesmo assim.
    const recorder = new TurnRecorder();
    recorder.deadlineCoversNeed = true;
    recorder.card({ kind: "quick_replies", options: ["Falar com um analista", "Adicionar informação", "Não, obrigado"] });
    recorder.finishAnalystOffer();
    expect(replies(recorder)).toEqual(["Adicionar informação", "Não, obrigado"]);
    expect(recorder.guardrails.join(" ")).toMatch(/prazo/i);
  });

  it("só o botão de analista: o card some", () => {
    const recorder = new TurnRecorder();
    recorder.deadlineCoversNeed = true;
    recorder.card({ kind: "quick_replies", options: ["Falar com um analista"] });
    recorder.finishAnalystOffer();
    expect(recorder.cards).toEqual([]);
  });

  it("frustração (ou outro motivo do código) continua oferecendo, mesmo com o prazo atendendo", () => {
    const recorder = new TurnRecorder();
    recorder.deadlineCoversNeed = true;
    recorder.offerAnalyst = true;
    recorder.finishAnalystOffer();
    expect(replies(recorder)).toEqual(["Falar com um analista"]);
  });

  it("sem motivo nenhum no turno, o botão de analista sai", () => {
    // Achado do funcionário simulado (senha-sap): reabriu o chamado e ofereceu analista "se precisar de prioridade imediata".
    const recorder = new TurnRecorder();
    recorder.card({ kind: "quick_replies", options: ["Falar com um analista", "Não, obrigado"] });
    recorder.finishAnalystOffer();
    expect(replies(recorder)).toEqual(["Não, obrigado"]);
    expect(recorder.guardrails.join(" ")).toMatch(/sem motivo/i);
  });

  it("chamado vencido consultado no turno justifica o botão que o modelo pôs", () => {
    const recorder = new TurnRecorder();
    recorder.overdueSeen = true;
    recorder.card({ kind: "quick_replies", options: ["Falar com um analista", "Adicionar informação", "Não, obrigado"] });
    recorder.finishAnalystOffer();
    expect(replies(recorder)).toEqual(["Falar com um analista", "Adicionar informação", "Não, obrigado"]);
  });
});
