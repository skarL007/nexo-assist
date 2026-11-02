/**
 * Padrão ouro da busca: mede os conjuntos congelados de gold.ts com os critérios da seção 4 de
 * docs/pesquisa/BASE-DE-CONHECIMENTO.md.
 *
 *   npm run eval:ouro              # 3 repetições do avaliador (padrão)
 *   npm run eval:ouro -- --runs=5
 *
 * Mede três sistemas nas mesmas perguntas: só palavras, híbrida (margem) e híbrida + avaliador
 * (produção). Para cada conjunto: acerto, artigo errado e abstenção com intervalo de Wilson,
 * Recall@5 da 1ª etapa, MRR e latência. Entre sistemas: McNemar pareado. O avaliador usa LLM,
 * então roda `--runs` vezes: o relatório traz a média, a pior rodada e quantas perguntas mudaram.
 * Grava evals/retrieval/results/<data>.json e docs/validacao/METRICAS-BUSCA-OURO.md (gerado; METRICAS-BUSCA.md é escrito à mão).
 * Custo: ~US$ 0,0003 por pergunta por rodada do avaliador (~US$ 0,10 com 3 rodadas).
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { articleText, JUDGE_CANDIDATES, MIN_MARGIN } from "@/application/knowledge-service";
import type { Embedder } from "@/application/ports";
import { SpendLedger } from "@/application/spend-ledger";
import { pricePerToken } from "@/agent/model-config";
import { FileSpendStore } from "@/infrastructure/repositories/spend-store";
import { env } from "@/config/env";
import { hybridSearch } from "@/domain/hybrid-search";
import { DEEPINFRA, OpenRouterEmbedder } from "@/infrastructure/ai/openrouter-embedder";
import { OpenRouterRelevanceJudge } from "@/infrastructure/ai/openrouter-relevance-judge";
import { articles } from "@/infrastructure/db/seed-data";
import { GOLD_SETS, GOLD_VERSION, type GoldSet } from "./gold";
import type { RetrievalQuery } from "./queries";
import { fingerprint, mcnemar, wilson } from "./stats";

type System = "palavras" | "hibrida" | "avaliador";
interface Outcome {
  ids: string[];
  ms: number;
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const ci = (k: number, n: number) => {
  const { low, high } = wilson(k, n);
  return `${pct(k / n)} [${pct(low)}–${pct(high)}]`;
};
const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
};
const right = (q: RetrievalQuery, ids: string[]) => (q.expected ? ids[0] === q.expected : ids.length === 0);
const wrongArticle = (q: RetrievalQuery, ids: string[]) => ids.length > 0 && ids[0] !== q.expected;

/** Sem chave (ou sem saldo): mede só a busca por palavras, que é determinística e não gasta. */
function keywordOnly() {
  const lines = [
    `# Métricas da busca · padrão ouro ${GOLD_VERSION} · só palavras`,
    "",
    "Medição determinística, sem embeddings nem avaliador (`npm run eval:ouro -- --so-palavras`). É o modo em que a busca cai quando os provedores estão fora do ar.",
    "",
    "| Conjunto | Papel | n | Acerto [IC 95%] | Artigo errado [IC 95%] | Abstenção correta |",
    "|---|---|---|---|---|---|",
  ];
  const pooled: boolean[] = [];
  for (const set of GOLD_SETS) {
    if (fingerprint(set.queries) !== set.fingerprint) throw new Error(`O conjunto ${set.id} mudou desde o congelamento: não meça com ele.`);
    const results = set.queries.map((q) => hybridSearch(articles, q.query, { queryVector: null, vectors: new Map(), minMargin: MIN_MARGIN }).map((m) => m.article.id));
    const ok = set.queries.map((q, i) => right(q, results[i]));
    pooled.push(...ok);
    const n = set.queries.length;
    const wrong = set.queries.filter((q, i) => wrongArticle(q, results[i])).length;
    const unanswerable = set.queries.filter((q) => !q.expected).length;
    const abstained = set.queries.filter((q, i) => !q.expected && !results[i].length).length;
    lines.push(`| ${set.id} | ${set.role} | ${n} | ${ci(ok.filter(Boolean).length, n)} | ${ci(wrong, n)} | ${abstained}/${unanswerable} |`);
  }
  lines.push(`| **todos** | | ${pooled.length} | **${ci(pooled.filter(Boolean).length, pooled.length)}** | | |`);
  console.log(lines.join("\n"));
}

async function main() {
  if (process.argv.includes("--so-palavras")) return keywordOnly();
  const config = env();
  process.env.SPEND_LEDGER_FILE ??= "evals/.gasto-llm.json";
  const ledger = new SpendLedger(new FileSpendStore(process.env.SPEND_LEDGER_FILE), { dailyUsd: config.LLM_DAILY_BUDGET_USD, totalUsd: config.LLM_TOTAL_BUDGET_USD });
  if (!config.DEEPINFRA_API_KEY && !config.OPENROUTER_API_KEY) throw new Error("Defina DEEPINFRA_API_KEY (ou OPENROUTER_API_KEY) no .env.");
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 3);
  // DeepInfra quando há a chave (02/11); senão o OpenRouter de antes. O avaliador segue o RELEVANCE_JUDGE_MODEL.
  const onDeepInfra = !!config.DEEPINFRA_API_KEY;
  const embedder: Embedder = onDeepInfra
    ? new OpenRouterEmbedder(config.DEEPINFRA_EMBEDDING_MODEL, config.DEEPINFRA_API_KEY!, DEEPINFRA)
    : new OpenRouterEmbedder(config.OPENROUTER_EMBEDDING_MODEL, config.OPENROUTER_API_KEY!);
  const judgeId = config.RELEVANCE_JUDGE_MODEL.replace(/^deepinfra\//, "");
  const judge = onDeepInfra ? new OpenRouterRelevanceJudge(judgeId, config.DEEPINFRA_API_KEY!, DEEPINFRA) : new OpenRouterRelevanceJudge(judgeId, config.OPENROUTER_API_KEY!);
  const judgePrice = pricePerToken(judge.model);

  for (const set of GOLD_SETS) {
    if (fingerprint(set.queries) !== set.fingerprint) throw new Error(`O conjunto ${set.id} mudou desde o congelamento: não meça com ele.`);
  }

  const docVectors = await embedder.embed(articles.map(articleText), "document");
  const vectors = new Map(articles.map((a, i) => [a.id, docVectors[i]]));
  const report: Record<string, unknown>[] = [];
  const md: string[] = [];
  const pooled: Record<System, boolean[]> = { palavras: [], hibrida: [], avaliador: [] };

  async function measure(set: GoldSet) {
    const t0 = Date.now();
    const queryVectors = await embedder.embed(set.queries.map((q) => q.query), "query");
    const embedMs = (Date.now() - t0) / set.queries.length;
    const keyword: Outcome[] = set.queries.map((q) => {
      const s = performance.now();
      const ids = hybridSearch(articles, q.query, { queryVector: null, vectors: new Map(), minMargin: MIN_MARGIN }).map((m) => m.article.id);
      return { ids, ms: performance.now() - s };
    });
    const candidates = set.queries.map((q, i) => hybridSearch(articles, q.query, { queryVector: queryVectors[i], vectors, minMargin: 0, limit: JUDGE_CANDIDATES }));
    const hybrid: Outcome[] = set.queries.map((q, i) => ({
      ids: hybridSearch(articles, q.query, { queryVector: queryVectors[i], vectors, minMargin: MIN_MARGIN }).map((m) => m.article.id),
      ms: embedMs,
    }));
    const judgedRuns: Outcome[][] = [];
    // Como em produção (KnowledgeService): avaliador fora do ar ou lento demais → resposta da híbrida com margem.
    let degraded = 0;
    for (let r = 0; r < runs; r++) {
      await ledger.assertCanSpend();
      const outcomes: Outcome[] = [];
      for (const [i, q] of set.queries.entries()) {
        const s = Date.now();
        const list = candidates[i].map((m) => m.article);
        let verdict: { applies: string | null; maybe: string | null };
        try {
          verdict = list.length ? await judge.judge(q.query, list) : { applies: null, maybe: null };
        } catch {
          degraded++;
          outcomes.push({ ids: hybrid[i].ids, ms: Date.now() - s + embedMs });
          continue;
        }
        // O avaliador não devolve o uso: estimativa de ~4 caracteres por token (prompt de ~600 tokens + candidatos).
        if (list.length && judgePrice) await ledger.record(((600 + list.reduce((s, a) => s + articleText(a).length, 0) / 4) * judgePrice.input) + 40 * judgePrice.output);
        const id = [verdict.applies, verdict.maybe].find((v) => v && list.some((c) => c.id === v));
        outcomes.push({ ids: id ? [id] : [], ms: Date.now() - s + embedMs });
      }
      judgedRuns.push(outcomes);
    }

    const n = set.queries.length;
    const answerable = set.queries.filter((q) => q.expected);
    const unanswerable = n - answerable.length;
    const recallAt5 = answerable.filter((q) => candidates[set.queries.indexOf(q)].some((m) => m.article.id === q.expected)).length;
    const mrr =
      answerable.reduce((sum, q) => {
        const rank = candidates[set.queries.indexOf(q)].findIndex((m) => m.article.id === q.expected);
        return sum + (rank >= 0 ? 1 / (rank + 1) : 0);
      }, 0) / Math.max(1, answerable.length);

    const score = (outcomes: Outcome[]) => {
      const ok = set.queries.map((q, i) => right(q, outcomes[i].ids));
      return {
        ok,
        right: ok.filter(Boolean).length,
        wrong: set.queries.filter((q, i) => wrongArticle(q, outcomes[i].ids)).length,
        abstained: set.queries.filter((q, i) => !q.expected && outcomes[i].ids.length === 0).length,
        p50: quantile(outcomes.map((o) => o.ms), 0.5),
        p95: quantile(outcomes.map((o) => o.ms), 0.95),
      };
    };
    const kw = score(keyword);
    const hy = score(hybrid);
    const judged = judgedRuns.map(score);
    const worst = judged.reduce((a, b) => (b.right < a.right ? b : a));
    const meanRight = judged.reduce((s, j) => s + j.right, 0) / runs;
    // Pergunta estável: mesmo resultado (certo ou errado) em todas as rodadas do avaliador.
    const unstable = set.queries.filter((_, i) => new Set(judged.map((j) => j.ok[i])).size > 1).length;
    const allRight = set.queries.filter((_, i) => judged.every((j) => j.ok[i])).length;

    pooled.palavras.push(...kw.ok);
    pooled.hibrida.push(...hy.ok);
    pooled.avaliador.push(...worst.ok);

    const vsHybrid = mcnemar(worst.ok, hy.ok);
    const vsKeyword = mcnemar(hy.ok, kw.ok);
    md.push(
      `### ${set.id} · ${set.role} · ${n} perguntas (${unanswerable} sem artigo) · impressão \`${set.fingerprint}\``,
      "",
      "| Sistema | Acerto [IC 95%] | Artigo errado [IC 95%] | Abstenção correta | p50 / p95 |",
      "|---|---|---|---|---|",
      `| Só palavras | ${ci(kw.right, n)} | ${ci(kw.wrong, n)} | ${kw.abstained}/${unanswerable} | <1 ms |`,
      `| Híbrida (margem ${MIN_MARGIN}) | ${ci(hy.right, n)} | ${ci(hy.wrong, n)} | ${hy.abstained}/${unanswerable} | ${Math.round(hy.p50)} ms |`,
      `| **Híbrida + avaliador, pior de ${runs}** | **${ci(worst.right, n)}** | **${ci(worst.wrong, n)}** | ${worst.abstained}/${unanswerable} | ${Math.round(worst.p50)} / ${Math.round(worst.p95)} ms |`,
      "",
      `- Recall@5 da 1ª etapa: ${ci(recallAt5, answerable.length)} · MRR ${mrr.toFixed(2).replace(".", ",")}`,
      `- Degradação para a híbrida (avaliador com erro ou acima de 4 s): ${degraded}/${n * runs} chamadas`,
      `- Avaliador em ${runs} rodadas: média ${(meanRight).toFixed(1).replace(".", ",")}/${n}; certas em todas: ${allRight}/${n}; perguntas que mudaram de resultado: ${unstable}`,
      `- McNemar, avaliador × híbrida: ${vsHybrid.aOnly} a ${vsHybrid.bOnly}, p = ${vsHybrid.p.toFixed(3).replace(".", ",")} · híbrida × palavras: ${vsKeyword.aOnly} a ${vsKeyword.bOnly}, p = ${vsKeyword.p.toFixed(3).replace(".", ",")}`,
    );

    if (set.role === "teste final") {
      const strata = [...new Set(set.queries.map((q) => q.stratum!))];
      md.push("", "| Estrato | n | Avaliador (pior rodada) | Híbrida | Palavras |", "|---|---|---|---|---|");
      for (const stratum of strata) {
        const idx = set.queries.flatMap((q, i) => (q.stratum === stratum ? [i] : []));
        const count = (ok: boolean[]) => `${idx.filter((i) => ok[i]).length}/${idx.length}`;
        md.push(`| ${stratum} | ${idx.length} | ${count(worst.ok)} | ${count(hy.ok)} | ${count(kw.ok)} |`);
      }
    }
    // Erros só dos conjuntos que podem ser olhados: o teste final não mostra quais perguntas errou.
    if (set.role !== "teste final") {
      const misses = set.queries.flatMap((q, i) => (worst.ok[i] ? [] : [`  - "${q.query}" → ${judgedRuns.map((r) => r[i].ids[0] ?? "nada").join(" / ")} (certo: ${q.expected ?? "nada"})`]));
      if (misses.length) md.push("- Erros do avaliador (rodadas):", ...misses);
    }
    md.push("");

    report.push({
      set: set.id,
      role: set.role,
      fingerprint: set.fingerprint,
      n,
      unanswerable,
      recallAt5: { k: recallAt5, n: answerable.length, ...wilson(recallAt5, answerable.length) },
      mrr,
      systems: {
        palavras: { right: kw.right, wrong: kw.wrong, abstained: kw.abstained },
        hibrida: { right: hy.right, wrong: hy.wrong, abstained: hy.abstained, p50: hy.p50 },
        avaliador: { runs: judged.map((j) => ({ right: j.right, wrong: j.wrong, abstained: j.abstained, p50: j.p50, p95: j.p95 })), unstable, allRight, degraded },
      },
      mcnemar: { avaliadorXhibrida: vsHybrid, hibridaXpalavras: vsKeyword },
    });
  }

  for (const set of GOLD_SETS) await measure(set);

  const sha = execSync("git rev-parse --short HEAD").toString().trim();
  const dirty = execSync("git status --porcelain").toString().trim() ? " (com mudanças locais)" : "";
  const date = new Date().toISOString().slice(0, 10);
  const header = [
    `# Métricas da busca · padrão ouro ${GOLD_VERSION}`,
    "",
    `Gerado por \`npm run eval:ouro\` em ${date}, código \`${sha}\`${dirty}. Embeddings \`${embedder.model}\`, avaliador \`${judge.model}\` (${runs} rodadas), ${articles.length} artigos. Critérios na seção 4 de [BASE-DE-CONHECIMENTO.md](../pesquisa/BASE-DE-CONHECIMENTO.md).`,
    "",
    "Leitura: \"Acerto\" é o artigo certo em 1º, ou nenhum quando não há artigo certo. \"Artigo errado\" é o erro que prejudica o funcionário (mostra o que não se aplica). Entre colchetes, o intervalo de confiança de 95% (Wilson). O avaliador usa LLM, então a tabela mostra a **pior** das rodadas.",
    "",
  ];
  const total = pooled.avaliador.length;
  const summary = [
    "## Todos os conjuntos juntos",
    "",
    `- Avaliador (pior rodada): ${ci(pooled.avaliador.filter(Boolean).length, total)} · híbrida: ${ci(pooled.hibrida.filter(Boolean).length, total)} · palavras: ${ci(pooled.palavras.filter(Boolean).length, total)}`,
    `- McNemar avaliador × híbrida em ${total} perguntas: ${(() => {
      const m = mcnemar(pooled.avaliador, pooled.hibrida);
      return `${m.aOnly} a ${m.bOnly}, p = ${m.p.toFixed(4).replace(".", ",")}`;
    })()}`,
    "",
  ];
  mkdirSync("evals/retrieval/results", { recursive: true });
  writeFileSync(`evals/retrieval/results/${date}.json`, JSON.stringify({ date, sha, gold: GOLD_VERSION, embedder: embedder.model, judge: judge.model, runs, sets: report }, null, 2));
  writeFileSync("docs/validacao/METRICAS-BUSCA-OURO.md", [...header, ...summary, "## Por conjunto", "", ...md].join("\n"));
  console.log([...header, ...summary, ...md].join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
