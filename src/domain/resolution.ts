/**
 * Resolução honesta: o que conta como "o agent resolveu", com regras publicadas
 * (no estilo de Intercom, Zendesk e Atlassian), e não "não chamou um humano".
 *
 * Cada conversa cai em um grupo, nesta ordem de precedência:
 *  human        teve transferência ou resposta de analista
 *  ticket       virou chamado (rascunho confirmado): bom encaminhamento, mas não é resolução
 *  in_progress  rascunho esperando o funcionário
 *  reopened     a pessoa voltou com o mesmo assunto em até 7 dias: deixa de contar
 *  confirmed    a última avaliação do "Isso resolveu?" foi "sim"
 *  not_resolved a última avaliação foi "não"
 *  abandoned    a última fala do agent foi uma pergunta (texto com "?" ou respostas rápidas), ou o agent nunca respondeu
 *  presumed     nada disso: a pessoa saiu sem pedir mais nada depois da resposta
 * Resolvidas = confirmed + presumed.
 */
import { tokenize } from "./knowledge";
import type { ChatMessage, DraftStatus } from "./message";

export const RESOLUTION_OUTCOMES = ["confirmed", "presumed", "ticket", "in_progress", "not_resolved", "abandoned", "reopened", "human"] as const;
export type ResolutionOutcome = (typeof RESOLUTION_OUTCOMES)[number];

export const REOPEN_WINDOW_MS = 7 * 86_400_000;

export interface ConversationFacts {
  id: string;
  employeeId: string;
  /** Em ordem de criação. */
  messages: Pick<ChatMessage, "id" | "role" | "text" | "cards" | "trace" | "createdAt">[];
  feedback: { messageId: string; helpful: boolean }[];
  drafts: DraftStatus[];
}

/** Palavras que aparecem em qualquer problema: não servem para dizer que é "o mesmo assunto". */
const GENERIC = new Set(
  "caiu parou travou trava funciona funcionando erro problema consigo consegui conseguir preciso ajuda quero novo nova hoje agora abrir abre acesso oi ola bom dia tarde noite obrigado obrigada favor pode voce aqui ainda mais vez".split(" "),
);

export function topicTerms(text: string): Set<string> {
  return new Set(tokenize(text).filter((t) => t.length >= 3 && !GENERIC.has(t) && !/^\d+$/.test(t)));
}

const time = (iso: string) => Date.parse(iso);

function sameTopicLater(a: ConversationFacts, b: ConversationFacts): boolean {
  if (a.id === b.id || a.employeeId !== b.employeeId || !a.messages.length || !b.messages.length) return false;
  const aEnd = time(a.messages[a.messages.length - 1].createdAt);
  const bStart = time(b.messages[0].createdAt);
  if (bStart <= time(a.messages[0].createdAt) || bStart - aEnd > REOPEN_WINDOW_MS) return false;
  const aTerms = topicTerms(a.messages.filter((m) => m.role === "employee").map((m) => m.text).join(" "));
  const bFirst = b.messages.find((m) => m.role === "employee");
  return !!bFirst && [...topicTerms(bFirst.text)].some((t) => aTerms.has(t));
}

function classify(conversation: ConversationFacts, all: ConversationFacts[]): ResolutionOutcome {
  const { messages } = conversation;
  if (messages.some((m) => m.role === "analyst" || m.cards.some((c) => c.kind === "handoff"))) return "human";
  if (conversation.drafts.includes("confirmed")) return "ticket";
  if (conversation.drafts.includes("pending")) return "in_progress";
  if (all.some((other) => sameTopicLater(conversation, other))) return "reopened";

  const order = new Map(messages.map((m, i) => [m.id, i]));
  const lastRating = [...conversation.feedback].sort((x, y) => (order.get(x.messageId) ?? -1) - (order.get(y.messageId) ?? -1)).at(-1);
  if (lastRating) return lastRating.helpful ? "confirmed" : "not_resolved";

  // Vale a última fala do agent: o funcionário pode fechar com um "obrigado" depois dela.
  const lastAgent = messages.findLast((m) => m.role === "agent");
  if (!lastAgent) return "abandoned";
  if (lastAgent.text.trim().endsWith("?") || lastAgent.cards.some((c) => c.kind === "quick_replies")) return "abandoned";
  return "presumed";
}

/** Só conversas em que o funcionário escreveu algo. */
export function classifyResolutions(conversations: ConversationFacts[]): Map<string, ResolutionOutcome> {
  const withEmployee = conversations.filter((c) => c.messages.some((m) => m.role === "employee"));
  return new Map(withEmployee.map((c) => [c.id, classify(c, withEmployee)]));
}

export interface ResolutionSummary {
  total: number;
  confirmed: number;
  presumed: number;
  ticket: number;
  inProgress: number;
  notResolved: number;
  abandoned: number;
  reopened: number;
  human: number;
  resolved: number;
  rate: number | null;
  costPerResolutionUsd: number | null;
}

export function summarizeResolutions(outcomes: Map<string, ResolutionOutcome>, costUsd: number | null): ResolutionSummary {
  const count = (outcome: ResolutionOutcome) => [...outcomes.values()].filter((o) => o === outcome).length;
  const resolved = count("confirmed") + count("presumed");
  return {
    total: outcomes.size,
    confirmed: count("confirmed"),
    presumed: count("presumed"),
    ticket: count("ticket"),
    inProgress: count("in_progress"),
    notResolved: count("not_resolved"),
    abandoned: count("abandoned"),
    reopened: count("reopened"),
    human: count("human"),
    resolved,
    rate: outcomes.size ? resolved / outcomes.size : null,
    costPerResolutionUsd: costUsd !== null && resolved ? costUsd / resolved : null,
  };
}
