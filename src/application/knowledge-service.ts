/**
 * Busca na central de ajuda: híbrida quando algum provedor de embeddings responde, só por palavras
 * quando nenhum responde. Os vetores dos artigos ficam no banco, por modelo, e só são recalculados
 * quando o texto muda.
 */
import { createHash } from "node:crypto";
import { describeChecksDone, type CheckDone, type DiagnosticCheck } from "@/domain/diagnostics";
import { hybridSearch, type HybridMatch } from "@/domain/hybrid-search";
import type { Article } from "@/domain/knowledge";
import type { ArticleRepository, Embedder } from "./ports";
import { ProviderBreaker } from "./provider-breaker";

/**
 * Margem mínima entre o 1º e o 2º artigo para responder com algum. Escolhida no benchmark
 * de recuperação (docs/validacao/BUSCA.md) numa faixa estável (0,015 a 0,03 dão o mesmo
 * resultado) e conferida num conjunto separado, escrito depois da escolha.
 */
export const MIN_MARGIN = 0.02;

export interface KnowledgeResult {
  matches: HybridMatch[];
  mode: "hybrid" | "keyword";
  /** Modelo de embeddings que respondeu; null na busca só por palavras. */
  model: string | null;
}

/** Texto que vira embedding. As verificações entram só quando existem: artigo sem elas mantém o hash (e o cache). */
export const articleText = (a: Article) =>
  [a.title, a.tags.join(", "), a.body, ...(a.checks?.length ? [a.checks.map((c) => c.label).join("; ")] : [])].join("\n");
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

export class KnowledgeService {
  /** `embedders` em ordem de preferência; lista vazia = só palavras. */
  constructor(
    private readonly articles: ArticleRepository,
    private readonly embedders: Embedder[],
    private readonly onError: (error: unknown, model: string) => void = () => {},
    private readonly breaker = new ProviderBreaker(),
    private readonly minMargin = MIN_MARGIN,
  ) {}

  async search(query: string, limit = 3): Promise<KnowledgeResult> {
    const articles = await this.articles.listAll();
    for (const embedder of this.embedders) {
      if (this.breaker.isOpen(embedder.model)) continue;
      try {
        const vectors = await this.articleVectors(articles, embedder);
        const [queryVector] = await embedder.embed([query], "query");
        return { matches: hybridSearch(articles, query, { queryVector, vectors, minMargin: this.minMargin, limit }), mode: "hybrid", model: embedder.model };
      } catch (error) {
        // Provedor fora do ar passa a vez ao próximo e fica de fora por um tempo (disjuntor).
        this.breaker.trip(embedder.model, error);
        this.onError(error, embedder.model);
      }
    }
    // Nenhum provedor respondeu: a busca não falha, volta para palavras-chave.
    return { matches: hybridSearch(articles, query, { queryVector: null, vectors: new Map(), minMargin: this.minMargin, limit }), mode: "keyword", model: null };
  }

  /** Texto das verificações feitas para a descrição do chamado, sempre a partir dos artigos da central. */
  async describeChecks(done: CheckDone[]): Promise<{ text: string | null; unknown: string[] }> {
    return describeChecksDone(await this.articles.listAll(), done);
  }

  async findCheck(checkId: string): Promise<{ articleId: string; check: DiagnosticCheck } | null> {
    for (const article of await this.articles.listAll()) {
      const check = article.checks?.find((c) => c.id === checkId);
      if (check) return { articleId: article.id, check };
    }
    return null;
  }

  private async articleVectors(articles: Article[], embedder: Embedder): Promise<Map<string, number[]>> {
    const cached = await this.articles.embeddings(embedder.model);
    const stale = articles.filter((a) => cached.get(a.id)?.contentHash !== hashOf(articleText(a)));
    if (stale.length) {
      const vectors = await embedder.embed(stale.map(articleText), "document");
      const items = stale.map((a, i) => ({ articleId: a.id, vector: vectors[i], contentHash: hashOf(articleText(a)) }));
      await this.articles.saveEmbeddings(embedder.model, items);
      items.forEach((item) => cached.set(item.articleId, item));
    }
    return new Map([...cached].map(([id, { vector }]) => [id, vector]));
  }
}
