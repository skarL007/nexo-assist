/**
 * Incidente em massa ("problema conhecido"): o PRD define impacto como quantas
 * pessoas são afetadas, mas o modelo só vê a mensagem de uma pessoa. Aqui o
 * sistema junta os relatos de várias pessoas, em código.
 *
 * Regra: incidentes (INC) abertos, criados nas últimas 4 horas úteis, mesma
 * categoria e uma palavra relevante do título em comum, de pelo menos 3 pessoas
 * diferentes. A saída não tem quem relatou nem os números dos chamados.
 */
import { businessMsBetween } from "./business-time";
import { isOpen, titleKeywords, type Category, type Ticket } from "./ticket";

export const KNOWN_ISSUE_MIN_PEOPLE = 3;
export const KNOWN_ISSUE_WINDOW_MS = 4 * 3_600_000; // em horas úteis

export interface KnownIssue {
  category: Category;
  terms: string[];
  /** Chamados no grupo. */
  reports: number;
  /** Pessoas diferentes. */
  people: number;
  since: Date;
}

type Report = Pick<Ticket, "type" | "category" | "title" | "status" | "ownerId" | "createdAt">;

export function detectKnownIssues(tickets: Report[], now: Date): KnownIssue[] {
  const recent = tickets.filter((t) => t.type === "INC" && isOpen(t) && t.createdAt <= now && businessMsBetween(t.createdAt, now) <= KNOWN_ISSUE_WINDOW_MS);
  const issues: KnownIssue[] = [];

  for (const [category, inCategory] of Map.groupBy(recent, (t) => t.category)) {
    let pool = inCategory.map((t) => ({ ticket: t, words: titleKeywords(t.title) }));
    for (;;) {
      // Palavra citada pelo maior número de pessoas diferentes.
      const people = new Map<string, Set<string>>();
      for (const { ticket, words } of pool) for (const word of words) people.set(word, (people.get(word) ?? new Set()).add(ticket.ownerId));
      const [term, owners] = [...people].sort((a, b) => b[1].size - a[1].size)[0] ?? [];
      if (!term || !owners || owners.size < KNOWN_ISSUE_MIN_PEOPLE) break;

      const group = pool.filter((r) => r.words.has(term));
      issues.push({
        category,
        terms: [term],
        reports: group.length,
        people: owners.size,
        since: new Date(Math.min(...group.map((r) => r.ticket.createdAt.getTime()))),
      });
      pool = pool.filter((r) => !r.words.has(term));
    }
  }
  return issues.sort((a, b) => b.people - a.people);
}

/** O problema que a pessoa está relatando é um incidente conhecido? (mesma categoria e o termo no título ou na descrição) */
export function knownIssueFor(candidate: { category: Category; title: string; description: string }, issues: KnownIssue[]): KnownIssue | null {
  const words = titleKeywords(`${candidate.title} ${candidate.description}`);
  return issues.find((issue) => issue.category === candidate.category && issue.terms.some((t) => words.has(t))) ?? null;
}
