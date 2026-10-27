import { describe, expect, it } from "vitest";
import { bootstrapMean, mean, percentile, randomWeights, seededRandom, spearman } from "./stats";

describe("estatística do benchmark", () => {
  it("percentil interpola entre os vizinhos", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 95)).toBeCloseTo(48);
    expect(percentile([7], 95)).toBe(7);
  });

  it("bootstrap é determinístico e o intervalo contém a média", () => {
    const values = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1];
    const a = bootstrapMean(values);
    expect(a).toEqual(bootstrapMean(values));
    expect(a.mean).toBe(0.7);
    expect(a.low).toBeLessThanOrEqual(0.7);
    expect(a.high).toBeGreaterThanOrEqual(0.7);
    expect(a.high - a.low).toBeGreaterThan(0.2); // n = 10: incerteza grande, e o número mostra
  });

  it("bootstrap de valores iguais não tem incerteza", () => {
    expect(bootstrapMean([1, 1, 1])).toEqual({ mean: 1, low: 1, high: 1 });
  });

  it("Spearman: mesma ordem = 1, ordem invertida = -1", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 45])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  });

  it("pesos sorteados somam 1 e são positivos", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const weights = randomWeights(4, random);
      expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1);
      expect(weights.every((w) => w > 0)).toBe(true);
    }
  });

  it("média de lista vazia é NaN (não zero, que pareceria um resultado)", () => {
    expect(mean([])).toBeNaN();
  });
});
