/**
 * Busca híbrida na central: sentido (embeddings) + palavras-chave.
 *
 * O sentido acerta sinônimos ("acessar a rede da empresa de casa" → VPN); as palavras
 * acertam termos exatos ("809", "SAP"), que entram como um bônus pequeno e com teto
 * (palavra solta como "erro" ou "computador" não arrasta artigo errado).
 *
 * Quando não há artigo certo, as similaridades ficam todas parecidas; quando há, um
 * artigo se destaca. Por isso a decisão de "nenhum artigo" usa a MARGEM entre o 1º e o
 * 2º lugar, não um valor absoluto (no benchmark, um Wi-Fi válido tinha 0,53 e "holerite",
 * sem artigo, 0,61; as margens foram ≥ 0,02 e ≤ 0,01). Números em docs/validacao/BUSCA.md.
 *
 * Sem vetores (embeddings fora do ar), o resultado é o da busca por palavras.
 */
import { searchArticles, type Article } from "./knowledge";

export interface HybridMatch {
  article: Article;
  matchedTerms: string[];
  /** Cosseno entre a pergunta e o artigo; null se a busca foi só por palavras. */
  similarity: number | null;
}

export interface HybridOptions {
  queryVector: number[] | null;
  vectors: Map<string, number[]>;
  /** Distância mínima entre o 1º e o 2º colocados para devolver algum artigo. */
  minMargin: number;
  limit?: number;
}

/** Bônus por ponto de palavra-chave (tag 3, título 2, corpo 1) e o teto dele. */
export const KEYWORD_BONUS = { perPoint: 0.01, cap: 0.05 };

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export function hybridSearch(articles: Article[], query: string, options: HybridOptions): HybridMatch[] {
  const limit = options.limit ?? 3;
  const keyword = searchArticles(articles, query, articles.length);
  const { queryVector } = options;
  if (!queryVector) return keyword.slice(0, limit).map((m) => ({ article: m.article, matchedTerms: m.matchedTerms, similarity: null }));

  const byId = new Map(keyword.map((m) => [m.article.id, m]));
  const ranked = articles
    .flatMap((article) => {
      const vector = options.vectors.get(article.id);
      if (!vector) return [];
      const similarity = cosineSimilarity(queryVector, vector);
      const bonus = Math.min(KEYWORD_BONUS.cap, KEYWORD_BONUS.perPoint * (byId.get(article.id)?.score ?? 0));
      return [{ article, similarity, combined: similarity + bonus }];
    })
    .sort((a, b) => b.combined - a.combined);

  // Ninguém se destaca: nenhum artigo responde (o agent não deve responder com um parecido).
  if (ranked.length > 1 && ranked[0].combined - ranked[1].combined < options.minMargin) return [];

  return ranked.slice(0, limit).map(({ article, similarity }) => ({ article, similarity, matchedTerms: byId.get(article.id)?.matchedTerms ?? [] }));
}
