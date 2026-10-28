/**
 * Benchmark de recuperação da central: palavras-chave × só sentido × híbrida.
 *
 *   npm run eval:busca
 *
 * Calcula os embeddings dos 9 artigos e das perguntas (chamadas em lote, frações de centavo),
 * mede hit@1, hit@3, MRR e abstenção no conjunto de calibração e no conjunto separado
 * (escrito depois da escolha da margem), e varre a margem para mostrar a faixa estável.
 */
import { articleText, MIN_MARGIN } from "@/application/knowledge-service";
import { env } from "@/config/env";
import { hybridSearch } from "@/domain/hybrid-search";
import { GeminiEmbedder } from "@/infrastructure/ai/gemini-embedder";
import { articles } from "@/infrastructure/db/seed-data";
import { scoreRetrieval, type RetrievalScore } from "./metrics";
import { holdoutQueries, retrievalQueries, type RetrievalQuery } from "./queries";

const MARGINS = [0, 0.01, 0.015, 0.02, 0.03, 0.04];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const row = (name: string, s: RetrievalScore) => `| ${name} | ${pct(s.hitAt1)} | ${pct(s.hitAt3)} | ${s.mrr.toFixed(2)} | ${pct(s.abstention)} | ${pct(s.accuracy)} |`;
const header = "| Busca | hit@1 | hit@3 | MRR | abstenção | acerto geral |\n|---|---|---|---|---|---|";

async function main() {
  const key = env().GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Defina GOOGLE_GENERATIVE_AI_API_KEY no .env para rodar o benchmark de busca.");
  const embedder = new GeminiEmbedder(env().EMBEDDING_MODEL, key);
  const docVectors = await embedder.embed(articles.map(articleText), "document");
  const vectors = new Map(articles.map((a, i) => [a.id, docVectors[i]]));
  const noVectors = new Map<string, number[]>();

  async function evaluate(title: string, queries: RetrievalQuery[], sweep: boolean) {
    const queryVectors = await embedder.embed(
      queries.map((q) => q.query),
      "query",
    );
    // Só sentido: a mesma busca com o texto dos artigos e da pergunta vazio, então o bônus de palavras é zero.
    const semanticOnly = (margin: number) =>
      queries.map((q, i) => hybridSearch(articles.map((a) => ({ ...a, title: "", body: "", tags: [] })), "", { queryVector: queryVectors[i], vectors, minMargin: margin }).map((m) => m.article.id));
    const hybrid = (margin: number) => queries.map((q, i) => hybridSearch(articles, q.query, { queryVector: queryVectors[i], vectors, minMargin: margin }).map((m) => m.article.id));
    const keyword = queries.map((q) => hybridSearch(articles, q.query, { queryVector: null, vectors: noVectors, minMargin: MIN_MARGIN }).map((m) => m.article.id));

    console.log(`\n### ${title} (${queries.length} perguntas, ${queries.filter((q) => !q.expected).length} sem artigo certo)\n`);
    console.log(header);
    console.log(row("Palavras-chave (antes)", scoreRetrieval(queries, keyword)));
    console.log(row(`Só sentido (margem ${MIN_MARGIN})`, scoreRetrieval(queries, semanticOnly(MIN_MARGIN))));
    console.log(row(`**Híbrida (margem ${MIN_MARGIN}, produção)**`, scoreRetrieval(queries, hybrid(MIN_MARGIN))));

    if (sweep) {
      console.log(`\nVarredura da margem (híbrida):\n`);
      console.log(header.replace("Busca", "Margem"));
      for (const m of MARGINS) console.log(row(String(m), scoreRetrieval(queries, hybrid(m))));
    }

    const result = hybrid(MIN_MARGIN);
    const misses = queries.flatMap((q, i) =>
      (q.expected ? result[i][0] !== q.expected : result[i].length > 0) ? [`- "${q.query}" → ${result[i].join(", ") || "nada"} (certo: ${q.expected ?? "nada"})`] : [],
    );
    console.log(`\nErros da híbrida (${misses.length}):\n${misses.join("\n") || "- nenhum"}`);
  }

  console.log(`Modelo de embeddings: ${embedder.model} (768 dimensões) · ${articles.length} artigos`);
  await evaluate("Conjunto de calibração", retrievalQueries, true);
  await evaluate("Conjunto separado (escrito depois da escolha)", holdoutQueries, false);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
