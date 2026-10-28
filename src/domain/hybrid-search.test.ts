import { describe, expect, it } from "vitest";
import { cosineSimilarity, hybridSearch } from "./hybrid-search";
import type { Article } from "./knowledge";

const article = (id: string, title: string, tags: string[] = []): Article => ({ id, title, body: title, tags });
const vpn = article("kb-vpn", "VPN com erro 809", ["vpn", "809"]);
const wifi = article("kb-wifi", "Wi-Fi corporativo", ["wifi", "rede"]);
const printer = article("kb-impressora", "Impressora não imprime", ["impressora"]);
const all = [vpn, wifi, printer];

// Vetores de brinquedo: o eixo 0 é "acesso remoto", o 1 é "rede sem fio", o 2 é "impressão".
const vectors = new Map([
  ["kb-vpn", [1, 0, 0]],
  ["kb-wifi", [0, 1, 0]],
  ["kb-impressora", [0, 0, 1]],
]);

describe("similaridade de cosseno", () => {
  it("1 para vetores iguais, 0 para ortogonais, e 0 (não NaN) para vetor nulo", () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("busca híbrida na central", () => {
  it("acha pelo sentido o que as palavras não acham (sinônimo, sem termo em comum)", () => {
    const matches = hybridSearch(all, "não consigo acessar o sistema da empresa de casa", { queryVector: [0.9, 0.1, 0], vectors, minMargin: 0.02 });
    expect(matches[0].article.id).toBe("kb-vpn");
    expect(matches[0].similarity).toBeCloseTo(0.994, 2);
    expect(matches[0].matchedTerms).toEqual([]);
  });

  it("ninguém se destaca (margem pequena entre 1º e 2º) → nenhum artigo, mesmo com similaridade alta", () => {
    // Achado do benchmark: "quando cai o meu holerite?" tinha 0,61 com dois artigos sem relação, empatados.
    expect(hybridSearch(all, "quando cai o meu holerite", { queryVector: [0.6, 0.6, 0.59], vectors, minMargin: 0.02 })).toEqual([]);
  });

  it("palavra-chave exata desempata, mas o bônus tem teto (não passa por cima do sentido)", () => {
    // Sentido empatado entre VPN e Wi-Fi: "809" decide.
    const tie = hybridSearch(all, "erro 809", { queryVector: [0.7, 0.7, 0], vectors, minMargin: 0.02 });
    expect(tie[0].article.id).toBe("kb-vpn");
    expect(tie[0].matchedTerms).toEqual(["erro", "809"]);
    // Sentido claramente de impressora: as palavras de VPN não bastam para virar o jogo.
    const clear = hybridSearch(all, "vpn 809 impressora", { queryVector: [0.3, 0, 0.95], vectors, minMargin: 0.02 });
    expect(clear[0].article.id).toBe("kb-impressora");
  });

  it("sem vetores (embeddings indisponíveis), é a busca por palavras de antes", () => {
    const matches = hybridSearch(all, "impressora parou", { queryVector: null, vectors: new Map(), minMargin: 0.02 });
    expect(matches.map((m) => m.article.id)).toEqual(["kb-impressora"]);
    expect(matches[0].similarity).toBeNull();
  });
});
