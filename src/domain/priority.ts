/**
 * Prioridade e prazo (SLA) — Anexo A.
 *
 * A prioridade é uma matriz impacto × urgência. Ela é calculada em código,
 * não pelo modelo: o LLM só informa impacto e urgência que entendeu da conversa.
 */
import { addBusinessDays, addBusinessHours, addCalendarHours } from "./business-time";
import { IMPACT_LABEL, PRIORITY_LABEL, isOpen, type Impact, type Priority, type Ticket } from "./ticket";

export const URGENCIES = ["blocked", "deadline_today", "has_workaround", "none"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_LABEL: Record<Urgency, string> = {
  blocked: "impede de trabalhar",
  deadline_today: "compromisso hoje",
  has_workaround: "há alternativa",
  none: "sem urgência",
};

const MATRIX: Record<Impact, Record<Urgency, Priority>> = {
  me: { blocked: "high", deadline_today: "high", has_workaround: "medium", none: "low" },
  team: { blocked: "critical", deadline_today: "critical", has_workaround: "high", none: "medium" },
  company: { blocked: "critical", deadline_today: "critical", has_workaround: "high", none: "medium" },
};

export interface PriorityDecision {
  priority: Priority;
  reason: string;
}

export function classifyPriority(impact: Impact, urgency: Urgency): PriorityDecision {
  const priority = MATRIX[impact][urgency];
  return {
    priority,
    reason: `Impacto: ${IMPACT_LABEL[impact].toLowerCase()} · urgência: ${URGENCY_LABEL[urgency]} → ${PRIORITY_LABEL[priority]}`,
  };
}

export const SLA_LABEL: Record<Priority, string> = {
  critical: "1 hora",
  high: "4 horas úteis",
  medium: "3 dias úteis",
  low: "5 dias úteis",
};

/** Prazo para a próxima resposta, contado a partir de `from`. Crítico tem plantão 24h. */
export function slaDeadline(priority: Priority, from: Date): Date {
  switch (priority) {
    case "critical":
      return addCalendarHours(from, 1);
    case "high":
      return addBusinessHours(from, 4);
    case "medium":
      return addBusinessDays(from, 3);
    case "low":
      return addBusinessDays(from, 5);
  }
}

export interface SlaStatus {
  deadline: Date;
  overdue: boolean;
}

/** O prazo vale para cada atualização: corre a partir da última. Resolvido não tem prazo. */
export function ticketSla(ticket: Pick<Ticket, "priority" | "status" | "updatedAt">, now: Date): SlaStatus | null {
  if (!isOpen(ticket)) return null;
  const deadline = slaDeadline(ticket.priority, ticket.updatedAt);
  return { deadline, overdue: now > deadline };
}
