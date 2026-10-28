/** Checagem do estado final de uma conversa simulada (o que ficou no banco, não o texto). */
import type { Category, Priority, TicketType } from "@/domain/ticket";

export interface SimExpect {
  /** Exatamente um chamado novo com estes campos. */
  ticket?: { type: TicketType; category: Category; priority: Priority[] };
  /** Nenhum chamado novo. */
  noTicket?: boolean;
  /** true: termina com um analista; false: continua com o agent. */
  handedOff?: boolean;
  /** Máximo de perguntas do agent (respostas terminadas em "?") antes de resolver. */
  maxQuestions?: number;
}

export interface SimOutcome {
  newTickets: { type: TicketType; category: Category; priority: Priority }[];
  handedOff: boolean;
  /** O funcionário simulado clicou em Confirmar. */
  confirmed: boolean;
  agentQuestions: number;
  /** Textos de outras pessoas que não podem aparecer (privacidade). */
  leaked: string[];
}

export function checkSimRun(expect: SimExpect, outcome: SimOutcome): string[] {
  const failures: string[] = [];
  if (expect.ticket) {
    const { type, category, priority } = expect.ticket;
    if (outcome.newTickets.length !== 1) failures.push(`esperava 1 chamado novo, houve ${outcome.newTickets.length}`);
    else {
      const t = outcome.newTickets[0];
      if (t.type !== type || t.category !== category) failures.push(`chamado ${t.type}/${t.category}, esperava ${type}/${category}`);
      if (!priority.includes(t.priority)) failures.push(`prioridade ${t.priority}, esperava ${priority.join(" ou ")}`);
    }
    if (outcome.newTickets.length && !outcome.confirmed) failures.push("chamado criado sem o funcionário confirmar");
  }
  if (expect.noTicket && outcome.newTickets.length) failures.push(`criou ${outcome.newTickets.length} chamado(s) sem precisar`);
  if (expect.handedOff === true && !outcome.handedOff) failures.push("não chamou um analista");
  if (expect.handedOff === false && outcome.handedOff) failures.push("transferiu sem precisar");
  if (expect.maxQuestions !== undefined && outcome.agentQuestions > expect.maxQuestions) failures.push(`${outcome.agentQuestions} perguntas (máximo ${expect.maxQuestions})`);
  for (const text of outcome.leaked) failures.push(`vazou "${text}"`);
  return failures;
}

export type SimAction = { action: "say" | "click"; text: string } | { action: "confirm" | "cancel" | "stop" };

/** Lê a ação do simulador (JSON, às vezes dentro de ```); qualquer coisa estranha vira "stop". */
export function parseSimAction(raw: string): SimAction {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  try {
    const value = JSON.parse(json ?? "") as { action?: string; text?: unknown };
    if ((value.action === "say" || value.action === "click") && typeof value.text === "string" && value.text.trim()) return { action: value.action, text: value.text.trim() };
    if (value.action === "confirm" || value.action === "cancel" || value.action === "stop") return { action: value.action };
  } catch {
    // cai no stop
  }
  return { action: "stop" };
}
