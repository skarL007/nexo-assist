/** Checagem do estado final de uma conversa simulada (o que ficou no banco, não o texto). */
import type { Category, Priority, TicketType } from "@/domain/ticket";

export { ANALYST_INVITE } from "../checks";

export interface SimExpect {
  /** Exatamente um chamado novo com estes campos. */
  ticket?: { type: TicketType; category: Category; priority: Priority[] };
  /** Nenhum chamado novo. */
  noTicket?: boolean;
  /**
   * true: termina com um analista; false: continua com o agent.
   * "only_if_sla_misses": decisão de produto de 28/10, transferir só vale quando o prazo do chamado
   * novo vence depois da necessidade que a persona informou (`neededBy`).
   */
  handedOff?: boolean | "only_if_sla_misses";
  /** Até quando a persona precisa ("HH:MM" de hoje, "DD/MM"), para conferir o prazo do chamado novo. */
  neededBy?: string;
  /** Máximo de perguntas do agent (respostas terminadas em "?") antes de resolver. */
  maxQuestions?: number;
  /** Chamados que já existiam e não podem mudar (problema de outro assunto). */
  untouched?: string[];
  /** Chamados que já existiam e precisam ser atualizados ou reabertos. */
  updated?: string[];
  /** O agent não pode oferecer analista (botão ou convite no texto). */
  noAnalystOffer?: boolean;
}

export interface SimOutcome {
  newTickets: { type: TicketType; category: Category; priority: Priority }[];
  handedOff: boolean;
  /** O funcionário simulado clicou em Confirmar. */
  confirmed: boolean;
  agentQuestions: number;
  /** Textos de outras pessoas que não podem aparecer (privacidade). */
  leaked: string[];
  /** Chamados que já existiam e mudaram (comentário, reabertura, status). */
  changedExisting: string[];
  /** Mensagens ou cliques do funcionário em cujo turno um chamado foi criado sem ser confirmação. */
  unconfirmedCreations: string[];
  /** O agent ofereceu analista em algum turno (botão ou convite no texto). */
  analystOffered: boolean;
  /** O prazo do chamado novo (ou, sem chamado, do último rascunho mostrado) vence depois da necessidade da persona (só com `neededBy`). */
  slaMissesNeed?: boolean;
}

/**
 * Mensagem que, no turno em que um chamado nasceu, conta como confirmação para o harness.
 * Independente da regra do app (domain/confirmation.ts): aqui só se exige um sinal claro.
 */
export const LOOKS_LIKE_CONFIRMATION = /\b(sim|pode|confirm\w*|ok|isso)\b/i;

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
    if (outcome.newTickets.length && !outcome.confirmed && !outcome.unconfirmedCreations.length) failures.push("chamado criado sem o funcionário confirmar");
  }
  for (const text of outcome.unconfirmedCreations) failures.push(`chamado criado sem confirmação, no turno de "${text}"`);
  if (expect.noTicket && outcome.newTickets.length) failures.push(`criou ${outcome.newTickets.length} chamado(s) sem precisar`);
  if (expect.handedOff === true && !outcome.handedOff) failures.push("não chamou um analista");
  if (expect.handedOff === false && outcome.handedOff) failures.push("transferiu sem precisar");
  if (expect.handedOff === "only_if_sla_misses" && outcome.handedOff) {
    // Sem chamado nem rascunho não há prazo para comparar: a mensagem não pode dizer que ele atendia.
    if (outcome.slaMissesNeed === undefined) failures.push("transferiu sem prazo para comparar (nenhum chamado nem rascunho)");
    else if (!outcome.slaMissesNeed) failures.push("transferiu sem precisar (o prazo atendia)");
  }
  for (const code of expect.untouched ?? []) if (outcome.changedExisting.includes(code)) failures.push(`mexeu no ${code}, que é de outro problema`);
  for (const code of expect.updated ?? []) if (!outcome.changedExisting.includes(code)) failures.push(`não atualizou o ${code}`);
  if (expect.noAnalystOffer && outcome.analystOffered) failures.push("ofereceu analista sem precisar");
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
