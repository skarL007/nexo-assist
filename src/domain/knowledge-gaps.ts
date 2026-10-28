/**
 * Lacunas da central de ajuda: buscas do agent que não acharam artigo (a busca
 * híbrida já abstém quando nada é parecido o bastante), agrupadas por tema.
 * Como nos "Suggested topics" da Atlassian, só aparece tema com um mínimo de
 * ocorrências. A frase de exemplo é do funcionário, com dados pessoais mascarados.
 */
import { topicTerms, type ConversationFacts, type ResolutionOutcome } from "./resolution";

export const MIN_GAP_OCCURRENCES = 3;
const ESCALATED: ReadonlySet<ResolutionOutcome> = new Set(["ticket", "human", "not_resolved", "in_progress"]);
const EXAMPLE_MAX = 140;

export interface HelpCenterSearch {
  query: string;
  found: boolean;
  /** A conversa terminou em chamado, analista ou "não resolveu". */
  escalated: boolean;
  /** Fala do funcionário naquele turno, já mascarada. */
  example: string;
}

export interface KnowledgeGap {
  terms: string[];
  searches: number;
  escalatedRate: number;
  example: string;
}

/** E-mail, CPF, telefone, número de chamado e números longos (matrícula, patrimônio) viram marcadores. */
export function maskPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g, "[CPF]")
    .replace(/\(\d{2}\)\s?\d{4,5}-?\d{4}\b/g, "[telefone]")
    .replace(/\b(INC|REQ)-\d+\b/gi, "[chamado]")
    .replace(/\b\d{6,}\b/g, "[número]");
}

/** As buscas na central gravadas nos traces, com o desfecho da conversa. */
export function helpCenterSearches(conversations: ConversationFacts[], outcomes: Map<string, ResolutionOutcome>): HelpCenterSearch[] {
  return conversations.flatMap((conversation) => {
    const outcome = outcomes.get(conversation.id);
    return conversation.messages.flatMap((message, index) => {
      const calls = message.role === "agent" ? (message.trace?.toolCalls ?? []).filter((c) => c.tool === "searchHelpCenter") : [];
      if (!calls.length) return [];
      const said = conversation.messages.slice(0, index).findLast((m) => m.role === "employee")?.text ?? "";
      const example = maskPersonalData(said).slice(0, EXAMPLE_MAX);
      return calls.map((call) => ({
        query: String((call.input as { query?: unknown })?.query ?? ""),
        found: ((call.output as { articles?: unknown[] })?.articles?.length ?? 0) > 0,
        escalated: outcome ? ESCALATED.has(outcome) : false,
        example,
      }));
    });
  });
}

/** Agrupa as buscas sem artigo pelo termo mais comum, de novo e de novo, enquanto houver tema com o mínimo. */
export function findKnowledgeGaps(searches: HelpCenterSearch[], minOccurrences = MIN_GAP_OCCURRENCES, limit = 5): KnowledgeGap[] {
  let pool = searches.filter((s) => !s.found).map((s) => ({ ...s, terms: [...topicTerms(s.query)] }));
  const gaps: KnowledgeGap[] = [];

  while (gaps.length < limit) {
    const top = mostCommon(pool.map((s) => s.terms));
    if (!top || top.count < minOccurrences) break;
    const group = pool.filter((s) => s.terms.includes(top.term));
    const second = mostCommon(group.map((s) => s.terms.filter((t) => t !== top.term)));
    gaps.push({
      terms: second && second.count >= Math.ceil(group.length / 2) ? [top.term, second.term] : [top.term],
      searches: group.length,
      escalatedRate: group.filter((s) => s.escalated).length / group.length,
      example: group[0].example,
    });
    pool = pool.filter((s) => !s.terms.includes(top.term));
  }
  return gaps;
}

/** Termo que aparece em mais listas (empate: o que apareceu primeiro). */
function mostCommon(lists: string[][]): { term: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const terms of lists) for (const term of new Set(terms)) counts.set(term, (counts.get(term) ?? 0) + 1);
  let best: { term: string; count: number } | null = null;
  for (const [term, count] of counts) if (!best || count > best.count) best = { term, count };
  return best;
}
