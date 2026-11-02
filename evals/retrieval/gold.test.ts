import { describe, expect, it } from "vitest";
import { articles } from "@/infrastructure/db/seed-data";
import { GOLD_SETS } from "./gold";
import { fingerprint } from "./stats";

describe("padrão ouro da busca", () => {
  it.each(GOLD_SETS.map((s) => [s.id, s] as const))("%s continua congelado (impressão digital confere)", (_id, set) => {
    expect(fingerprint(set.queries)).toBe(set.fingerprint);
  });

  it("nenhuma pergunta aparece em dois conjuntos (calibração vazando para o teste invalida a medida)", () => {
    const normalized = GOLD_SETS.flatMap((s) => s.queries.map((q) => q.query.trim().toLowerCase()));
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("todo artigo esperado existe na central, e todo conjunto tem perguntas sem artigo certo", () => {
    const ids = new Set(articles.map((a) => a.id));
    for (const set of GOLD_SETS) {
      expect(set.queries.filter((q) => q.expected && !ids.has(q.expected))).toEqual([]);
      expect(set.queries.some((q) => q.expected === null)).toBe(true);
    }
  });

  it("existe exatamente um teste final, e ele cobre os sete estratos", () => {
    const finals = GOLD_SETS.filter((s) => s.role === "teste final");
    expect(finals).toHaveLength(1);
    expect(new Set(finals[0].queries.map((q) => q.stratum))).toEqual(new Set(["defeito", "pedido", "fora", "termo", "coloquial", "digitacao", "ingles"]));
  });
});
