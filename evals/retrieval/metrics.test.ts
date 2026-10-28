import { describe, expect, it } from "vitest";
import { scoreRetrieval } from "./metrics";

describe("métricas do benchmark de recuperação", () => {
  it("hit@1, hit@3, MRR e abstenção", () => {
    const queries = [
      { query: "a", expected: "x" }, // certo em 1º
      { query: "b", expected: "y" }, // certo em 2º
      { query: "c", expected: "z" }, // não veio
      { query: "d", expected: null }, // nada: abstenção certa
      { query: "e", expected: null }, // veio algo: errado
    ];
    const score = scoreRetrieval(queries, [["x", "y"], ["x", "y"], ["x"], [], ["x"]]);
    expect(score.hitAt1).toBeCloseTo(1 / 3);
    expect(score.hitAt3).toBeCloseTo(2 / 3);
    expect(score.mrr).toBeCloseTo((1 + 0.5 + 0) / 3);
    expect(score.abstention).toBe(0.5);
    expect(score.accuracy).toBeCloseTo(2 / 5);
  });
});
