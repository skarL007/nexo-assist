/**
 * Prazo em risco, com o porquê (inspirado no "Explain SLA" da ServiceNow): além de dizer
 * que o prazo está acabando, o sistema mostra a conta — prioridade, janela, de quando
 * conta, quanto falta em tempo útil e quanto o relógio ficou parado fora do expediente.
 *
 * Em risco = 75% ou mais da janela já usada. Tudo calculado aqui, sem o modelo.
 */
import { businessMsBetween } from "./business-time";
import { ticketSla } from "./priority";
import type { Priority, Ticket } from "./ticket";

/** A partir de quanto da janela usada o prazo conta como "em risco". */
export const AT_RISK_FRACTION = 0.75;

export interface SlaRisk {
  code: string;
  title: string;
  priority: Priority;
  level: "at_risk" | "overdue";
  /** De quando o prazo conta (a última atualização do chamado). */
  from: Date;
  deadline: Date;
  /** Quanto da janela já foi usado (0 a 1, em tempo útil; crítico em tempo corrido). */
  usedFraction: number;
  /** Tempo útil que falta (0 se venceu). */
  remainingMs: number;
  /** Atraso em tempo útil (0 se não venceu). */
  overdueMs: number;
  /** Tempo corrido em que o relógio ficou parado (noites e fins de semana). Crítico: 0. */
  pausedMs: number;
}

type TicketForSla = Pick<Ticket, "code" | "title" | "priority" | "status" | "updatedAt">;

export function slaRisk(ticket: TicketForSla, now: Date): SlaRisk | null {
  const sla = ticketSla(ticket, now);
  if (!sla) return null;

  // Crítico tem plantão 24 h: conta em tempo corrido.
  const between = ticket.priority === "critical" ? (a: Date, b: Date) => Math.max(0, b.getTime() - a.getTime()) : businessMsBetween;
  const window = between(ticket.updatedAt, sla.deadline);
  const until = now < sla.deadline ? now : sla.deadline;
  const used = between(ticket.updatedAt, until);
  const usedFraction = window ? used / window : 1;
  if (!sla.overdue && usedFraction < AT_RISK_FRACTION) return null;

  return {
    code: ticket.code,
    title: ticket.title,
    priority: ticket.priority,
    level: sla.overdue ? "overdue" : "at_risk",
    from: ticket.updatedAt,
    deadline: sla.deadline,
    usedFraction,
    remainingMs: sla.overdue ? 0 : window - used,
    overdueMs: sla.overdue ? between(sla.deadline, now) : 0,
    pausedMs: until.getTime() - ticket.updatedAt.getTime() - used,
  };
}
