import { describe, expect, it } from "vitest";
import { estimateCost, SpendTracker } from "./budget";

describe("controle de gasto", () => {
  it("estima pelo preço por token do catálogo", () => {
    // Gemini 3.5 Flash: US$ 1,50 / 1M entrada, US$ 9,00 / 1M saída; 11 turnos de 10k + 400 tokens.
    const price = { input: 1.5e-6, output: 9e-6 };
    expect(estimateCost(price, 11, { input: 10_000, output: 400 })).toBeCloseTo(0.2046, 4);
  });

  it("para antes de estourar o teto, respeitando a reserva dos juízes", () => {
    const tracker = new SpendTracker(1.8);
    tracker.add(1.3);
    expect(tracker.fits(0.1, 0.35)).toBe(true);
    expect(tracker.fits(0.2, 0.35)).toBe(false);
    expect(tracker.remainingUsd).toBeCloseTo(0.5);
  });
});
