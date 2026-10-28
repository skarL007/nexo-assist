/**
 * Busca na central de ajuda: híbrida quando há embeddings, só por palavras quando não há.
 * Os vetores dos artigos ficam no banco e só são recalculados quando o texto muda.
 */
import { createHash } from "node:crypto";
import { hybridSearch, type HybridMatch } from "@/domain/hybrid-search";
import type { Article } from "@/domain/knowledge";
import type { ArticleRepository, Embedder } from "./ports";

/**
 * Margem mínima entre o 1º e o 2º artigo para responder com algum. Escolhida no benchmark
 * de recuperação (docs/validacao/BUSCA.md) numa faixa estável (0,015 a 0,03 dão o mesmo
 * resultado) e conferida num conjunto separado, escrito depois da escolha.
 */
export const MIN_MARGIN = 0.02;

export interface KnowledgeResult {
  matches: HybridMatch[];
  mode: "hybrid" | "keyword";
}

export const articleText = (a: Article) => `${a.title}\n${a.tags.join(", ")}\n${a.body}`;
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

export class KnowledgeService {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly embedder: Embedder | null,
    private readonly onError: (error: unknown) => void = () => {},
    private readonly minMargin = MIN_MARGIN,
  ) {}

  async search(query: string, limit = 3): Promise<KnowledgeResult> {
    const articles = await this.articles.listAll();
    const keywordOnly = (): KnowledgeResult => ({
      matches: hybridSearch(articles, query, { queryVector: null, vectors: new Map(), minMargin: this.minMargin, limit }),
      mode: "keyword",
    });
    if (!this.embedder) return keywordOnly();

    try {
      const vectors = await this.articleVectors(articles, this.embedder);
      const [queryVector] = await this.embedder.embed([query], "query");
      return { matches: hybridSearch(articles, query, { queryVector, vectors, minMargin: this.minMargin, limit }), mode: "hybrid" };
    } catch (error) {
      // Embeddings fora do ar não derrubam a busca: volta para palavras-chave.
      this.onError(error);
      return keywordOnly();
    }
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
