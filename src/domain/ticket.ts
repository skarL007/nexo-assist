/**
 * Chamado (ticket) — tipos, valores permitidos e rótulos em português.
 * Arquivo puro: sem banco, sem rede. Pode ser importado no servidor e no browser.
 */

export const TICKET_TYPES = ["INC", "REQ"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const CATEGORIES = ["access", "network", "hardware", "software", "email", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TICKET_STATUSES = ["open", "waiting_analyst", "in_progress", "approved", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Quem é afetado — é o "impacto" da regra de prioridade. */
export const IMPACTS = ["me", "team", "company"] as const;
export type Impact = (typeof IMPACTS)[number];

export interface Ticket {
  code: string; // ex.: INC-20311
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  impact: Impact;
  ownerId: string;
  createdAt: Date;
  /** Última atualização: é a partir dela que o prazo (SLA) corre. */
  updatedAt: Date;
  resolvedAt: Date | null;
}

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  access: "Acesso",
  network: "Rede e VPN",
  hardware: "Hardware",
  software: "Software",
  email: "E-mail",
  other: "Outros",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto",
  waiting_analyst: "Aguardando analista",
  in_progress: "Em andamento",
  approved: "Aprovado",
  resolved: "Resolvido",
};

export const IMPACT_LABEL: Record<Impact, string> = {
  me: "Somente você",
  team: "Sua equipe",
  company: "Toda a empresa",
};

export const REOPEN_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isOpen = (ticket: Pick<Ticket, "status">) => ticket.status !== "resolved";

/** Resolvido há até 7 dias pode ser reaberto (Anexo A). */
export function canReopen(ticket: Pick<Ticket, "status" | "resolvedAt">, now: Date): boolean {
  if (ticket.status !== "resolved" || !ticket.resolvedAt) return false;
  return now.getTime() - ticket.resolvedAt.getTime() <= REOPEN_WINDOW_DAYS * DAY_MS;
}
