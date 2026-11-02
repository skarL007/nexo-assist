/**
 * Padrão ouro da busca: quais conjuntos existem, o papel de cada um e a impressão digital que os
 * congela (critérios 4.1 e 4.6 de docs/pesquisa/BASE-DE-CONHECIMENTO.md).
 *
 * - calibração: pode ajustar limiar, prompt e pesos olhando os erros;
 * - validação: decide entre alternativas (McNemar), sem ajustar fino nos erros;
 * - teste final: roda uma vez por versão; ninguém olha os erros para ajustar.
 *
 * Mudou uma pergunta? Não edite: crie um conjunto novo (ou suba a versão) e explique o porquê.
 * gold.test.ts falha se o conteúdo não bater com a impressão registrada aqui.
 */
import { confusionQueries, diagnosticQueries, finalTestQueries, holdoutQueries, retrievalQueries, type RetrievalQuery } from "./queries";

export type GoldRole = "calibração" | "validação" | "teste final";

export interface GoldSet {
  id: string;
  role: GoldRole;
  /** Quando foi congelado e em que condição (antes ou depois de olhar os erros). */
  frozen: string;
  fingerprint: string;
  queries: RetrievalQuery[];
}

export const GOLD_VERSION = "v1 (02/11/2026)";

export const GOLD_SETS: GoldSet[] = [
  { id: "calibracao", role: "calibração", frozen: "28/10, usado para escolher a margem", fingerprint: "b651914761f1", queries: retrievalQueries },
  { id: "separado", role: "validação", frozen: "28/10, escrito depois da margem; erros vistos em 29/10", fingerprint: "0f4e642ab971", queries: holdoutQueries },
  { id: "diagnostico", role: "validação", frozen: "29/10, escrito depois da margem; erros vistos", fingerprint: "0224a332384a", queries: diagnosticQueries },
  { id: "confusao", role: "validação", frozen: "30/10, antes do avaliador; erros vistos no desenho dele", fingerprint: "d188581ce803", queries: confusionQueries },
  { id: "teste-final-v1", role: "teste final", frozen: "02/11, antes de qualquer medição", fingerprint: "0c5c0421c5f8", queries: finalTestQueries },
];
