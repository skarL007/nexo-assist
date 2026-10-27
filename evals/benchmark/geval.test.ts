import { describe, expect, it } from "vitest";
import { CRITERIA, expectedScore, judgePrompt, scoresFromLogprobs, scoresFromText } from "./geval";

const lp = (p: number) => Math.log(p);

describe("G-Eval: nota ponderada pela probabilidade", () => {
  it("média ponderada dos dígitos, ignorando tokens que não são nota", () => {
    // 60% "5", 30% "4", 10% "**" → (0,6·5 + 0,3·4) / 0,9 = 4,667
    const score = expectedScore([
      { token: "5", logprob: lp(0.6) },
      { token: "4", logprob: lp(0.3) },
      { token: "**", logprob: lp(0.1) },
    ]);
    expect(score).toBeCloseTo(4.667, 3);
  });

  it("dígito com espaço ou dois-pontos colado conta como a mesma nota", () => {
    expect(expectedScore([{ token: " 3", logprob: lp(0.5) }, { token: ": 3", logprob: lp(0.5) }])).toBe(3);
  });

  it("sem massa suficiente nos dígitos não inventa nota", () => {
    expect(expectedScore([{ token: "A", logprob: lp(0.9) }, { token: "5", logprob: lp(0.1) }])).toBeNull();
  });

  it("acha a nota de cada critério na sequência de tokens, mesmo com o id quebrado em pedaços", () => {
    const tokens = [
      { token: "<|sep|>", logprob: 0, top_logprobs: [] },
      { token: "res", logprob: 0, top_logprobs: [] },
      { token: "olucao", logprob: 0, top_logprobs: [] },
      { token: ":", logprob: 0, top_logprobs: [] },
      { token: " 4", logprob: lp(0.7), top_logprobs: [{ token: " 4", logprob: lp(0.7) }, { token: " 5", logprob: lp(0.3) }] },
      { token: "\n", logprob: 0, top_logprobs: [] },
      { token: "clareza", logprob: 0, top_logprobs: [] },
      { token: ":", logprob: 0, top_logprobs: [] },
      { token: " 2", logprob: lp(0.99), top_logprobs: [] },
    ];
    const parsed = scoresFromLogprobs(tokens);
    expect(parsed.scores.resolucao).toBeCloseTo(4.3);
    expect(parsed.methods.resolucao).toBe("logprobs");
    expect(parsed.scores.clareza).toBe(2);
    expect(parsed.scores.conducao).toBeUndefined();
  });

  it("lê notas do texto para juízes sem logprobs", () => {
    expect(scoresFromText("resolucao: 5\nconducao: **4**\nclareza=3\ntom: 9")).toEqual({ resolucao: 5, conducao: 4, clareza: 3 });
  });

  it("o formulário pede todos os critérios e traz as regras do agent", () => {
    const [, user] = judgePrompt("FUNCIONÁRIO: oi\nAGENT: Olá!", {});
    for (const c of CRITERIA) expect(user.content).toContain(`${c.id}: <nota>`);
    expect(user.content).toContain("Nexo Assist");
  });
});
