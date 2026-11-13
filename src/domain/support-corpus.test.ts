import { describe, expect, it } from "vitest";
import { buildSupportGraph, searchSupportCorpus, evaluateSupportRetrieval, type SupportDocument } from "./support-corpus";

const doc = (id: string, markdown: string, products = ["Teams"]): SupportDocument => ({
  id, title: id, markdown, products, audience: "ITPro", language: "en-US",
  sourcePath: `Teams/sign-in/${id}.md`, sourceUrl: `https://learn.microsoft.com/${id}`,
  downloadUrl: `https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/${"a".repeat(40)}/Teams/sign-in/${id}.md`,
  revision: "a".repeat(40), sha256: "b".repeat(64), license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/", publisher: "Microsoft",
});
const documents = [
  doc("auth", "Credential 0x123 diagnostic. [Next](loop.md#browser) [duplicate](loop.md) [include](../../includes/disclaimer.md)"),
  doc("loop", "Browser cookies persist."),
  doc("cache", "Clear the application cache."),
];

describe("corpus externo e grafo", () => {
  it("liga apenas referências verificáveis, deduplica e registra o hyperlink", () => {
    const graph = buildSupportGraph(documents);
    expect(graph.edges.filter(e => e.kind === "references")).toEqual([
      { from: "auth", to: "loop", kind: "references", evidence: "loop.md#browser" },
    ]);
    expect(graph.edges.filter(e => e.kind === "applies_to")).toHaveLength(3);
    expect(graph.nodes.find(n => n.id === "product:Teams")?.kind).toBe("product");
  });
  it("resolve links absolutos canônicos e ignora destinos externos", () => {
    const graph = buildSupportGraph([doc("auth", "[Canonical](https://learn.microsoft.com/loop#section) [External](https://example.com/cache.md)"), documents[1]]);
    expect(graph.edges.filter(e => e.kind === "references").map(e => e.to)).toEqual(["loop"]);
  });
  it("rejeita IDs ou caminhos duplicados", () => {
    expect(() => buildSupportGraph([documents[0], documents[0]])).toThrow(/duplicad/i);
  });
  it("recupera diagnóstico por BM25 e adiciona referência com caminho explícito", () => {
    const graph = buildSupportGraph(documents);
    expect(searchSupportCorpus(documents, graph, "0x123", { graph: false, k: 3 }).map(r => r.id)).toEqual(["auth"]);
    const result = searchSupportCorpus(documents, graph, "0x123", { graph: true, k: 3 });
    expect(result.map(r => r.id)).toEqual(["auth", "loop"]);
    expect(result[1].via).toEqual(["auth"]);
    expect(result[1].sourceUrl).toBe(documents[1].sourceUrl);
    expect(result.map(r => r.id)).not.toContain("cache");
  });
  it("não expande dois saltos nem inventa resposta sem correspondência", () => {
    const docs = [documents[0], doc("loop", "[More](cache.md)"), documents[2]];
    expect(searchSupportCorpus(docs, buildSupportGraph(docs), "0x123", { graph: true, k: 3 }).map(r => r.id)).toEqual(["auth", "loop"]);
    expect(searchSupportCorpus(docs, buildSupportGraph(docs), "holerite férias", { graph: true, k: 3 })).toEqual([]);
  });
  it("não indexa frontmatter, URLs ou marcação como conteúdo lexical", () => {
    const docs = [doc("auth", "---\nmanager: secreto\n---\nVisible [link](https://example.com/invisivel)")];
    expect(searchSupportCorpus(docs, buildSupportGraph(docs), "secreto invisivel", { graph: false, k: 3 })).toEqual([]);
  });
  it("calcula métricas no mesmo k e distingue casos sem resposta", () => {
    const report = evaluateSupportRetrieval(documents, [
      { id: "1", query: "0x123", relevantIds: ["auth", "loop"] },
      { id: "2", query: "holerite", relevantIds: [] },
    ], 2);
    expect(report.baseline.recallAtK).toBe(0.5);
    expect(report.graph.recallAtK).toBe(1);
    expect(report.baseline.precisionAtK).toBe(0.5);
    expect(report.graph.precisionAtK).toBe(1);
    expect(report.graph.mrrAtK).toBe(1);
    expect(report.graph.noAnswerAccuracy).toBe(1);
    expect(report.answerableCases).toBe(1);
  });
  it("rejeita avaliação vazia, rótulos desconhecidos, IDs repetidos e k inválido", () => {
    expect(() => evaluateSupportRetrieval(documents, [], 3)).toThrow();
    expect(() => evaluateSupportRetrieval(documents, [{ id: "1", query: "x", relevantIds: ["unknown"] }], 3)).toThrow();
    expect(() => evaluateSupportRetrieval(documents, [{ id: "1", query: "x", relevantIds: ["auth", "auth"] }], 3)).toThrow();
    expect(() => searchSupportCorpus(documents, buildSupportGraph(documents), "x", { graph: false, k: 0 })).toThrow();
  });
});
