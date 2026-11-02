/**
 * Central de ajuda — busca por palavras-chave.
 *
 * É o modo em que a busca cai quando os embeddings estão fora do ar, e o bônus de termos exatos
 * ("809", "SAP") da busca híbrida. Grátis e explicável: o trace mostra os termos que bateram.
 *
 * Regras de precisão (02/11, medidas em docs/validacao/METRICAS-BUSCA.md), todas de princípio e
 * nenhuma ligada a uma pergunta específica:
 * - **o objeto sozinho não escolhe artigo:** "notebook esquentando" bate em "notebook" do artigo de
 *   pedido, mas nada diz que é pedido nem qual é o defeito. Precisa de um termo específico, ou de um
 *   sinal de pedido quando o artigo é de pedido;
 * - **defeito não vai para artigo de pedido:** "o headset não pega minha voz" não é pedir headset;
 * - **palavra fraca** ("erro", "problema") sozinha não escolhe artigo;
 * - **léxico curto de TI** (iPhone → celular) e **uma letra errada** em palavra longa;
 * - **flexões** pelo radical ("imprimir" × "imprime"), só contra tags e título;
 * - **tag de várias palavras** conta pela frase inteira ("não liga"), com o "não"; logo depois de um
 *   objeto, ela descreve o objeto ("mouse sem fio" não é o Wi-Fi);
 * - **uma palavra só no corpo** é evidência fraca: o termo específico vem da tag ou do título, ou são
 *   dois termos específicos no corpo ("escritório" sozinho não escolhe o artigo do cabo).
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

/** Objetos: dizem do que se fala, não o que aconteceu nem o que se quer. */
const OBJECTS = new Set("computador notebook note laptop pc desktop monitor tela teclado mouse headset fone celular smartphone equipamento".split(" "));
/** Palavras fracas: aparecem em qualquer problema. */
const WEAK = new Set("erro erros problema problemas falha falhas funciona funcionando consigo sistema ajuda".split(" "));
/** Sinais de pedido (algo novo) e de defeito (algo que parou). Contados com stopwords, por causa do "não". */
const REQUEST = new Set("quero queria preciso precisava gostaria pedir peco solicitar solicito novo nova novos novas outro outra trocar ganhar".split(" "));
const DEFECT = new Set("nao parou quebrou quebrado travou travado travada caiu morreu pega".split(" "));
/** Léxico de TI: variações que querem dizer o mesmo termo da central. */
const SYNONYMS: Record<string, string> = {
  iphone: "celular",
  android: "celular",
  smartphone: "celular",
  multifuncional: "impressora",
  laptop: "notebook",
  feriado: "horario",
  feriados: "horario",
};

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/\be-?mails?\b/g, "email") // "e-mails" não vira "e" + "mails"
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function tokenize(text: string): string[] {
  return normalize(text).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Distância de edição ≤ 1 (troca, inserção, remoção ou duas letras vizinhas trocadas). */
function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.slice(i) === long.slice(i + 1);
}

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/** Termo da pergunta → termo do artigo: exato, uma letra errada (≥ 5 letras) ou mesmo radical (≥ 6). */
function resolve(term: string, exact: Set<string>, fuzzy: Set<string>): string | null {
  if (exact.has(term)) return term;
  if (term.length < 5) return null;
  for (const word of fuzzy) {
    if (word.length >= 5 && oneEditApart(term, word)) return word;
    if (term.length >= 6 && word.length >= 6 && commonPrefix(term, word) >= 6) return word;
  }
  return null;
}

const WEIGHT = { tag: 3, title: 2, body: 1 };

const isRequestArticle = (article: Article) => tokenize(article.title).some((t) => t === "pedir" || t === "solicitar");

export function searchArticles(articles: Article[], query: string, limit = 3): ArticleMatch[] {
  const raw = normalize(query);
  const phraseText = ` ${raw.join(" ")} `;
  const terms = [...new Set(tokenize(query).map((t) => SYNONYMS[t] ?? t))];
  const wantsSomething = raw.some((t) => REQUEST.has(t));
  const reportsDefect = raw.some((t) => DEFECT.has(t)) && !wantsSomething;

  return articles
    .map((article) => {
      const singleTags = article.tags.filter((tag) => !tag.includes(" "));
      const phraseTags = article.tags.filter((tag) => tag.includes(" ")).map((tag) => normalize(tag).join(" "));
      const tags = new Set(singleTags.flatMap(tokenize));
      const title = new Set(tokenize(article.title));
      const body = new Set(tokenize(article.body));
      const all = new Set([...tags, ...title, ...body]);
      const tagsAndTitle = new Set([...tags, ...title]);
      let score = 0;
      const matchedTerms: string[] = [];
      /** Termos específicos que bateram em tag, frase ou título (fortes) e só no corpo (fracos). */
      let strong = 0;
      let bodyOnly = 0;
      const isSpecific = (t: string) => !OBJECTS.has(t) && !WEAK.has(t) && !REQUEST.has(t);

      for (const term of terms) {
        const word = resolve(term, all, tagsAndTitle);
        if (!word) continue;
        const termScore = (tags.has(word) ? WEIGHT.tag : 0) + (title.has(word) ? WEIGHT.title : 0) + (body.has(word) ? WEIGHT.body : 0);
        if (termScore > 0) matchedTerms.push(word);
        score += termScore;
        if (isSpecific(word)) {
          if (tagsAndTitle.has(word)) strong++;
          else bodyOnly++;
        }
      }
      for (const phrase of phraseTags) {
        // "mouse sem fio" é um atributo do mouse; "computador não liga" é o que aconteceu (frase com "não").
        const describesObject = !phrase.startsWith("nao ") && [...OBJECTS].some((object) => phraseText.includes(` ${object} ${phrase} `));
        if (phraseText.includes(` ${phrase} `) && !describesObject) {
          matchedTerms.push(phrase);
          score += WEIGHT.tag;
          strong++;
        }
      }

      const request = isRequestArticle(article);
      const specific = strong > 0 || bodyOnly >= 2;
      const eligible = request ? !reportsDefect && (specific || (wantsSomething && matchedTerms.length > 0)) : specific;
      return { article, score: eligible ? score : 0, matchedTerms };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
