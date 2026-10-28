/**
 * Alternativa antes da prioridade (spec 01, "Alternativa antes da prioridade").
 *
 * "Há alternativa" e "sem urgência" dão prioridades diferentes em todas as linhas da
 * matriz. Num incidente "sem urgência" em que ninguém falou de alternativa, a prioridade
 * depende de um fato que o agent não sabe: antes do rascunho, pergunta (uma vez, dentro
 * do limite de perguntas). Achado do funcionário simulado de 28/10 (`outlook-direto` #2).
 */
import type { Card } from "./message";
import type { Urgency } from "./priority";
import type { TicketType } from "./ticket";

export const WORKAROUND_OPTIONS = ["Tenho alternativa", "Não tenho alternativa"] as const;

/** Acima disto (perguntas do agent na conversa), o rascunho sai com o que já se sabe. */
export const MAX_INTAKE_QUESTIONS = 3;

type HistoryMessage = { role: string; text: string; cards: Card[] };

export type WorkaroundDecision =
  | { action: "ask"; options: string[] }
  | { action: "draft"; urgency: Urgency; corrected: boolean };

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** O agent perguntou sobre alternativa (no texto ou nos botões). */
const ASKED = /\b(alternativ\w*|webmail|contorn\w*|outr[oa] (jeito|forma|caminho|computador|notebook|navegador|programa|maquina|impressora|sala|equipamento))\b/;

/** O funcionário já disse se há alternativa ou se consegue trabalhar (para um lado ou para o outro). */
const MENTIONED = new RegExp(
  [
    ASKED.source,
    /\b(pelo|no) celular\b/.source,
    /\bda (pra|para) (usar|trabalhar|seguir)\b/.source,
    /\bconsigo (trabalhar|seguir|usar)\b/.source,
    /\bparad[oa]\b/.source,
    /\bimpede\b/.source,
    /\benquanto isso\b/.source,
  ].join("|"),
);

export function mentionsWorkaround(text: string): boolean {
  return MENTIONED.test(normalize(text));
}

function askedAboutWorkaround(message: HistoryMessage): boolean {
  const options = message.cards.flatMap((c) => (c.kind === "quick_replies" ? c.options : []));
  return [message.text, ...options].some((text) => ASKED.test(normalize(text)));
}

/** Perguntas do agent na conversa: resposta terminada em "?" ou com respostas rápidas. */
export function countAgentQuestions(history: HistoryMessage[]): number {
  return history.filter((m) => m.role === "agent" && (m.text.trim().endsWith("?") || m.cards.some((c) => c.kind === "quick_replies"))).length;
}

const [HAS, HAS_NOT] = WORKAROUND_OPTIONS.map(normalize);

/**
 * Antes de montar o rascunho de um chamado novo: pergunta se há alternativa, corrige a
 * urgência pela resposta dos botões ou segue com a urgência que o modelo mandou.
 */
export function decideWorkaround(input: { type: TicketType; urgency: Urgency }, history: HistoryMessage[]): WorkaroundDecision {
  const keep: WorkaroundDecision = { action: "draft", urgency: input.urgency, corrected: false };
  if (input.type !== "INC" || input.urgency !== "none") return keep;

  const employeeTexts = history.filter((m) => m.role === "employee").map((m) => normalize(m.text));
  const answer = employeeTexts.findLast((text) => text === HAS || text === HAS_NOT);
  if (answer === HAS) return { action: "draft", urgency: "has_workaround", corrected: true };
  if (answer === HAS_NOT) return keep;

  if (employeeTexts.some((text) => MENTIONED.test(text))) return keep;
  if (history.some((m) => m.role === "agent" && askedAboutWorkaround(m))) return keep;
  if (countAgentQuestions(history) >= MAX_INTAKE_QUESTIONS) return keep;
  return { action: "ask", options: [...WORKAROUND_OPTIONS] };
}
