/**
 * Benchmark de recuperação da central: palavras-chave × só sentido × híbrida.
 *
 *   npm run eval:busca                        # pelo OpenRouter (1º provedor da produção)
 *   npm run eval:busca -- --provider=google   # pelo Gemini direto (2º provedor)
 *
 * Com a OPENROUTER_API_KEY, mede também o avaliador de relevância (RELEVANCE_JUDGE_MODEL) sobre os
 * 5 candidatos da híbrida, como na produção; "talvez" conta como artigo devolvido. Custa ~US$ 0,02.
 *
 * Calcula os embeddings dos artigos e das perguntas (chamadas em lote, frações de centavo),
 * mede hit@1, hit@3, MRR e abstenção no conjunto de calibração e no conjunto separado
 * (escrito depois da escolha da margem), e varre a margem para mostrar a faixa estável.
 */
import { articleText, JUDGE_CANDIDATES, MIN_MARGIN } from "@/application/knowledge-service";
import type { Embedder, RelevanceJudge } from "@/application/ports";
import { env } from "@/config/env";
import { hybridSearch } from "@/domain/hybrid-search";
import { GeminiEmbedder } from "@/infrastructure/ai/gemini-embedder";
import { OpenRouterEmbedder } from "@/infrastructure/ai/openrouter-embedder";
import { OpenRouterRelevanceJudge } from "@/infrastructure/ai/openrouter-relevance-judge";
import { articles } from "@/infrastructure/db/seed-data";
import { scoreRetrieval, type RetrievalScore } from "./metrics";
import { confusionQueries, diagnosticQueries, holdoutQueries, retrievalQueries, type RetrievalQuery } from "./queries";

const MARGINS = [0, 0.01, 0.015, 0.02, 0.03, 0.04];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const row = (name: string, s: RetrievalScore) => `| ${name} | ${pct(s.hitAt1)} | ${pct(s.hitAt3)} | ${s.mrr.toFixed(2)} | ${pct(s.abstention)} | ${pct(s.accuracy)} |`;
const header = "| Busca | hit@1 | hit@3 | MRR | abstenção | acerto geral |\n|---|---|---|---|---|---|";

function embedderFor(provider: string): Embedder {
  const config = env();
  if (provider === "openrouter") {
    if (!config.OPENROUTER_API_KEY) throw new Error("Defina OPENROUTER_API_KEY no .env para medir pelo OpenRouter.");
    return new OpenRouterEmbedder(config.OPENROUTER_EMBEDDING_MODEL, config.OPENROUTER_API_KEY);
  }
  if (provider === "google") {
    if (!config.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("Defina GOOGLE_GENERATIVE_AI_API_KEY no .env para medir pelo Gemini direto.");
    return new GeminiEmbedder(config.EMBEDDING_MODEL, config.GOOGLE_GENERATIVE_AI_API_KEY);
  }
  throw new Error(`--provider deve ser openrouter ou google (veio "${provider}").`);
}

async function main() {
  const provider = process.argv.find((a) => a.startsWith("--provider="))?.split("=")[1] ?? "openrouter";
  const embedder = embedderFor(provider);
  const docVectors = await embedder.embed(articles.map(articleText), "document");
  const vectors = new Map(articles.map((a, i) => [a.id, docVectors[i]]));
  const noVectors = new Map<string, number[]>();
  const config = env();
  const judge: RelevanceJudge | null =
    config.OPENROUTER_API_KEY && config.RELEVANCE_JUDGE_MODEL !== "off" ? new OpenRouterRelevanceJudge(config.RELEVANCE_JUDGE_MODEL, config.OPENROUTER_API_KEY) : null;
  const totals = { right: 0, wrongArticle: 0, wrongAbstention: 0, n: 0 };

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
    console.log(row(`${judge ? "" : "**"}Híbrida (margem ${MIN_MARGIN}${judge ? ", sem avaliador" : ", produção"})${judge ? "" : "**"}`, scoreRetrieval(queries, hybrid(MIN_MARGIN))));
    const judged: string[][] = [];
    if (judge) {
      for (const [i, q] of queries.entries()) {
        const candidates = hybridSearch(articles, q.query, { queryVector: queryVectors[i], vectors, minMargin: 0, limit: JUDGE_CANDIDATES }).map((m) => m.article);
        const verdict = candidates.length ? await judge.judge(q.query, candidates) : { applies: null, maybe: null };
        const id = [verdict.applies, verdict.maybe].find((v) => v && candidates.some((c) => c.id === v));
        judged.push(id ? [id] : []);
      }
      console.log(row(`**Híbrida + avaliador (${judge.model}, produção)**`, scoreRetrieval(queries, judged)));
    }

    if (sweep) {
      console.log(`\nVarredura da margem (híbrida):\n`);
      console.log(header.replace("Busca", "Margem"));
      for (const m of MARGINS) console.log(row(String(m), scoreRetrieval(queries, hybrid(m))));
    }

    const result = judge ? judged : hybrid(MIN_MARGIN);
    const misses = queries.flatMap((q, i) =>
      (q.expected ? result[i][0] !== q.expected : result[i].length > 0) ? [`- "${q.query}" → ${result[i].join(", ") || "nada"} (certo: ${q.expected ?? "nada"})`] : [],
    );
    queries.forEach((q, i) => {
      totals.n++;
      if (q.expected ? result[i][0] === q.expected : !result[i].length) totals.right++;
      else if (result[i].length) totals.wrongArticle++;
      else totals.wrongAbstention++;
    });
    console.log(`\nErros da produção (${misses.length}):\n${misses.join("\n") || "- nenhum"}`);
  }

  console.log(`Modelo de embeddings: ${embedder.model} (768 dimensões) · ${articles.length} artigos`);
  await evaluate("Conjunto de calibração", retrievalQueries, true);
  await evaluate("Conjunto separado (escrito depois da escolha)", holdoutQueries, false);
  await evaluate("Artigos de diagnóstico (escritos depois da escolha)", diagnosticQueries, false);
  await evaluate("Pedido × defeito × fora da central (congelado em 30/10, antes da correção)", confusionQueries, false);
  console.log(
    `
Produção nos ${totals.n}: ${totals.right} certos (${pct(totals.right / totals.n)}) · ${totals.wrongArticle} com artigo errado · ${totals.wrongAbstention} sem artigo quando havia um`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
