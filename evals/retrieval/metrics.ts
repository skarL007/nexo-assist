/** Métricas do benchmark de recuperação (puras, testadas em metrics.test.ts). */
import type { RetrievalQuery } from "./queries";

export interface RetrievalScore {
  /** Perguntas com artigo certo em que ele veio em 1º. */
  hitAt1: number;
  /** ... em que ele veio entre os 3 primeiros. */
  hitAt3: number;
  /** Mean Reciprocal Rank: 1 no 1º lugar, 1/2 no 2º, 1/3 no 3º, 0 fora. */
  mrr: number;
  /** Perguntas sem artigo certo em que a busca não devolveu nada. */
  abstention: number;
  /** Acerto geral: artigo certo em 1º, ou nada quando não há artigo certo. */
  accuracy: number;
}

export function scoreRetrieval(queries: RetrievalQuery[], results: string[][]): RetrievalScore {
  const answerable = queries.flatMap((q, i) => (q.expected ? [{ expected: q.expected, ids: results[i] }] : []));
  const unanswerable = queries.flatMap((q, i) => (q.expected ? [] : [results[i]]));
  const rank = (ids: string[], expected: string) => ids.slice(0, 3).indexOf(expected);
  const hits1 = answerable.filter((a) => rank(a.ids, a.expected) === 0).length;
  const hits3 = answerable.filter((a) => rank(a.ids, a.expected) >= 0).length;
  const mrr = answerable.reduce((sum, a) => sum + (rank(a.ids, a.expected) >= 0 ? 1 / (rank(a.ids, a.expected) + 1) : 0), 0);
  const abstained = unanswerable.filter((ids) => ids.length === 0).length;
  return {
    hitAt1: hits1 / answerable.length,
    hitAt3: hits3 / answerable.length,
    mrr: mrr / answerable.length,
    abstention: unanswerable.length ? abstained / unanswerable.length : 1,
    accuracy: (hits1 + abstained) / queries.length,
  };
}
