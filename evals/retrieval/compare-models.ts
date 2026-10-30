/**
 * Compara modelos de embeddings do OpenRouter na busca da central, com as mesmas perguntas do eval:busca
 * e a mesma busca híbrida da produção, varrendo a margem. Foi o que escolheu o provedor em 30/10/2026
 * (docs/validacao/BUSCA.md). Custo da rodada com os 5 modelos: menos de US$ 0,001.
 *
 *   npx tsx --env-file=.env evals/retrieval/compare-models.ts
 */
import { articleText } from "@/application/knowledge-service";
import { env } from "@/config/env";
import { hybridSearch } from "@/domain/hybrid-search";
import { articles } from "@/infrastructure/db/seed-data";
import { scoreRetrieval } from "./metrics";
import { diagnosticQueries, holdoutQueries, retrievalQueries, type RetrievalQuery } from "./queries";

const INSTRUCTION = "Instruct: Given an employee's IT help-desk message, retrieve the help-center article that solves it\nQuery: ";
/** Prefixos e dimensões que cada família de modelo espera (e5 e Qwen3 pedem prefixo na pergunta). */
const MODELS: { id: string; dimensions?: number; queryPrefix?: string; documentPrefix?: string }[] = [
  { id: "google/gemini-embedding-2", dimensions: 768 },
  { id: "baai/bge-m3" },
  { id: "intfloat/multilingual-e5-large", queryPrefix: "query: ", documentPrefix: "passage: " },
  { id: "qwen/qwen3-embedding-8b", queryPrefix: INSTRUCTION },
  { id: "openai/text-embedding-3-small" },
];
const MARGINS = [0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.08];
const SETS: [string, RetrievalQuery[]][] = [
  ["calibração", retrievalQueries],
  ["separado", holdoutQueries],
  ["diagnóstico", diagnosticQueries],
];
const pct = (v: number) => `${Math.round(v * 100)}%`;
let cost = 0;

async function embed(model: string, input: string[], dimensions?: number): Promise<number[][]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env().OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model, input, encoding_format: "float", ...(dimensions ? { dimensions } : {}) }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await response.json()) as { data?: { index: number; embedding: number[] }[]; usage?: { cost?: number } };
  if (!response.ok || !body.data) throw new Error(`${model}: ${response.status}`);
  cost += body.usage?.cost ?? 0;
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function main() {
  if (!env().OPENROUTER_API_KEY) throw new Error("Defina OPENROUTER_API_KEY no .env.");
  for (const m of MODELS) {
    const docs = await embed(m.id, articles.map((a) => (m.documentPrefix ?? "") + articleText(a)), m.dimensions);
    const vectors = new Map(articles.map((a, i) => [a.id, docs[i]]));
    const queryVectors = await Promise.all(SETS.map(([, qs]) => embed(m.id, qs.map((q) => (m.queryPrefix ?? "") + q.query), m.dimensions)));

    console.log(`\n### ${m.id} (${docs[0].length} dimensões)\n`);
    console.log(`| Margem | ${SETS.map(([name]) => name).join(" | ")} | total |\n|---|---|---|---|---|`);
    for (const margin of MARGINS) {
      let hits = 0;
      const cells = SETS.map(([, qs], s) => {
        const results = qs.map((q, i) => hybridSearch(articles, q.query, { queryVector: queryVectors[s][i], vectors, minMargin: margin }).map((r) => r.article.id));
        const accuracy = scoreRetrieval(qs, results).accuracy;
        hits += Math.round(accuracy * qs.length);
        return pct(accuracy);
      });
      const total = SETS.reduce((n, [, qs]) => n + qs.length, 0);
      console.log(`| ${margin} | ${cells.join(" | ")} | ${hits}/${total} (${pct(hits / total)}) |`);
    }
  }
  console.log(`\nCusto informado pelo OpenRouter: US$ ${cost.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
