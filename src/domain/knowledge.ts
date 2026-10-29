/**
 * Central de ajuda — busca por palavras-chave.
 *
 * Com 5 a 10 artigos, busca por palavras é suficiente, grátis e explicável
 * (dá para mostrar no trace por que um artigo foi escolhido). Com centenas de
 * artigos, trocaríamos por embeddings sem mudar quem chama esta função.
 */

import type { DiagnosticCheck } from "./diagnostics";

export interface Article {
  id: string;
  title: string;
  body: string;
  tags: string[];
  /** Verificações que o funcionário faz sozinho, uma por vez (artigos de equipamento). */
  checks?: DiagnosticCheck[];
}

export interface ArticleMatch {
  article: Article;
  score: number;
  matchedTerms: string[];
}

const STOPWORDS = new Set(
  "a o e de da do das dos em no na nos nas um uma uns umas para por com sem que se meu minha meus minhas eu me ao aos as os ou mas como esta este isso esse essa nao sim ja tem ter foi ser estou esta qual quais quando onde".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

const WEIGHT = { tag: 3, title: 2, body: 1 };

export function searchArticles(articles: Article[], query: string, limit = 3): ArticleMatch[] {
  const terms = [...new Set(tokenize(query))];

  return articles
    .map((article) => {
      const tags = new Set(article.tags.flatMap(tokenize));
      const title = new Set(tokenize(article.title));
      const body = new Set(tokenize(article.body));
      let score = 0;
      const matchedTerms: string[] = [];

      for (const term of terms) {
        const termScore =
          (tags.has(term) ? WEIGHT.tag : 0) + (title.has(term) ? WEIGHT.title : 0) + (body.has(term) ? WEIGHT.body : 0);
        if (termScore > 0) matchedTerms.push(term);
        score += termScore;
      }
      return { article, score, matchedTerms };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
