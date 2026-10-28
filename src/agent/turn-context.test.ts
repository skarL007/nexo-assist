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
