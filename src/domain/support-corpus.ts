/** Corpus experimental: conteúdo externo é evidência, nunca uma instrução executável. */
export interface SupportDocument {
  id: string; title: string; markdown: string; products: string[]; audience: string; language: string;
  sourcePath: string; sourceUrl: string; downloadUrl: string; revision: string; sha256: string;
  publisher: string; license: string; licenseUrl: string;
}
export interface SupportGraph {
  nodes: { id: string; kind: "article" | "product"; label: string }[];
  edges: { from: string; to: string; kind: "references" | "applies_to"; evidence: string }[];
}
export interface SupportCase { id: string; query: string; relevantIds: string[] }

const content = (text: string) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
const terms = (text: string) => (text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{2,}/g) ?? [])
  .filter(t => !new Set(["the", "and", "for", "with", "this", "that", "you", "your", "from", "are", "uma", "para", "com", "que", "como", "de", "do", "da", "os", "as", "to", "of", "in", "is", "on", "or", "an"]).has(t));
const cleanUrl = (url: string) => url.split(/[?#]/)[0].replace(/\/$/, "");

export function buildSupportGraph(documents: SupportDocument[]): SupportGraph {
  if (new Set(documents.map(d => d.id)).size !== documents.length || new Set(documents.map(d => d.sourcePath)).size !== documents.length) throw new Error("Documento duplicado");
  const nodes: SupportGraph["nodes"] = documents.map(d => ({ id: d.id, kind: "article", label: d.title }));
  const edges: SupportGraph["edges"] = [];
  const products = new Set<string>();
  const byPath = new Map(documents.map(d => [d.sourcePath, d.id]));
  const byUrl = new Map(documents.map(d => [cleanUrl(d.sourceUrl), d.id]));
  for (const doc of documents) {
    for (const product of new Set(doc.products)) {
      const id = `product:${product}`;
      if (!products.has(id)) nodes.push({ id, kind: "product", label: product });
      products.add(id);
      edges.push({ from: doc.id, to: id, kind: "applies_to", evidence: "Metadados revisados no manifesto" });
    }
    const linked = new Set<string>();
    // Apenas links inline explícitos. Includes e links fora do snapshot não viram relações inferidas.
    for (const match of content(doc.markdown).matchAll(/(?<!!)\[[^\]]+\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const href = match[1];
      let to: string | undefined;
      try {
        const url = new URL(href, `https://corpus.invalid/${doc.sourcePath}`);
        to = url.origin === "https://corpus.invalid" ? byPath.get(decodeURIComponent(url.pathname.slice(1))) : byUrl.get(cleanUrl(url.href));
      } catch { continue; }
      if (to && to !== doc.id && !linked.has(to)) {
        edges.push({ from: doc.id, to, kind: "references", evidence: href });
        linked.add(to);
      }
    }
  }
  return { nodes, edges };
}

/** BM25 fixo (k1=1.2, b=.75), sem tradução nem ajuste ao conjunto de avaliação. */
export function searchSupportCorpus(documents: SupportDocument[], graph: SupportGraph, query: string, options: { graph: boolean; k: number }) {
  if (!Number.isInteger(options.k) || options.k < 1 || options.k > 100) throw new Error("k deve estar entre 1 e 100");
  const queryTerms = [...new Set(terms(query))];
  const tokens = documents.map(d => terms(`${d.title} ${d.title} ${content(d.markdown).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, "")}`));
  const average = tokens.reduce((n, t) => n + t.length, 0) / (documents.length || 1) || 1;
  const scores = documents.map((doc, i) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = tokens[i].filter(t => t === term).length;
      if (!tf) continue;
      const df = tokens.filter(t => t.includes(term)).length;
      score += Math.log(1 + (documents.length - df + 0.5) / (df + 0.5)) * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * tokens[i].length / average));
    }
    return { id: doc.id, title: doc.title, sourceUrl: doc.sourceUrl, language: doc.language, audience: doc.audience, score, lexicalScore: score, via: [] as string[] };
  });
  if (options.graph) {
    const seeds = [...scores].filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 3);
    for (const seed of seeds) {
      for (const edge of graph.edges.filter(e => e.kind === "references" && e.from === seed.id)) {
        const hit = scores.find(s => s.id === edge.to);
        if (hit) { hit.score += seed.lexicalScore * 0.25; hit.via.push(seed.id); }
      }
    }
  }
  return scores.filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, options.k);
}

export function evaluateSupportRetrieval(documents: SupportDocument[], cases: SupportCase[], k: number) {
  const ids = new Set(documents.map(d => d.id));
  if (!cases.length || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error("Casos vazios ou duplicados");
  for (const c of cases) {
    if (!c.query.trim() || new Set(c.relevantIds).size !== c.relevantIds.length || c.relevantIds.some(id => !ids.has(id))) throw new Error(`Rótulos inválidos: ${c.id}`);
  }
  const graph = buildSupportGraph(documents);
  const run = (useGraph: boolean) => {
    const rows = cases.map(c => {
      const retrievedIds = searchSupportCorpus(documents, graph, c.query, { graph: useGraph, k }).map(r => r.id);
      const hits = retrievedIds.filter(id => c.relevantIds.includes(id)).length;
      const first = retrievedIds.findIndex(id => c.relevantIds.includes(id));
      return { id: c.id, retrievedIds, relevantIds: c.relevantIds, recall: c.relevantIds.length ? hits / c.relevantIds.length : null, precision: hits / k, reciprocalRank: first < 0 ? 0 : 1 / (first + 1) };
    });
    const answerable = rows.filter(r => r.recall !== null);
    const empty = rows.filter(r => r.recall === null);
    return {
      recallAtK: answerable.length ? answerable.reduce((n, r) => n + r.recall!, 0) / answerable.length : null,
      precisionAtK: answerable.length ? answerable.reduce((n, r) => n + r.precision, 0) / answerable.length : null,
      mrrAtK: answerable.length ? answerable.reduce((n, r) => n + r.reciprocalRank, 0) / answerable.length : null,
      noAnswerAccuracy: empty.length ? empty.filter(r => !r.retrievedIds.length).length / empty.length : null, rows,
    };
  };
  return { k, totalCases: cases.length, answerableCases: cases.filter(c => c.relevantIds.length).length, baseline: run(false), graph: run(true) };
}
