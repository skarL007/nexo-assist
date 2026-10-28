/**
 * Chamado (ticket) — tipos, valores permitidos e rótulos em português.
 * Arquivo puro: sem banco, sem rede. Pode ser importado no servidor e no browser.
 */
import { tokenize } from "./knowledge";

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

// Palavras que aparecem em quase todo título e não dizem qual é o problema.
const GENERIC_WORDS = new Set(["problema", "problemas", "erro", "erros", "falha", "funciona", "funcionando", "consigo", "preciso", "pedido", "chamado", "ajuda"]);

/** Palavras relevantes de um título (duplicidade e incidente em massa). */
export const titleKeywords = (title: string) => new Set(tokenize(title).filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word)));

/**
 * Possível duplicado: mesmo tipo, mesma categoria e pelo menos uma palavra relevante em comum no título.
 * Só a categoria juntava "Tela não está ligando" com "Segundo monitor para home office"; e um pedido
 * (REQ) de monitor novo não é o mesmo problema que um incidente (INC) com o monitor.
 */
export function sameProblem(ticket: Pick<Ticket, "type" | "category" | "title">, candidate: Pick<Ticket, "type" | "category" | "title">): boolean {
  if (ticket.type !== candidate.type || ticket.category !== candidate.category) return false;
  const existing = titleKeywords(ticket.title);
  return [...titleKeywords(candidate.title)].some((word) => existing.has(word));
}

/** Programas e termos de e-mail: o chamado vai para a fila de E-mail, não de Software. */
const EMAIL_TERMS = /\b(outlook|thunderbird|webmail|exchange|e-?mails?|caixa de (entrada|e-?mail|correio)|correio eletronico)\b/;

/**
 * Corrige a categoria de um chamado novo pelo título: programa de e-mail é E-mail.
 * Só Software e Outros mudam; Acesso (senha do e-mail) e as demais ficam como o modelo mandou.
 */
export function categoryForTitle(title: string, category: Category): Category {
  if (category !== "software" && category !== "other") return category;
  const normalized = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return EMAIL_TERMS.test(normalized) ? "email" : category;
}

/**
 * O problema relatado é do mesmo assunto do chamado existente? Categoria diferente é outro
 * problema (Outlook não complementa "Notebook lento"); Hardware e Software contam juntos,
 * porque o sintoma de um aparece no outro ("o notebook trava ao abrir o Excel").
 */
export function sameSubject(ticketCategory: Category, reportedCategory: Category): boolean {
  if (ticketCategory === reportedCategory) return true;
  const device = new Set<Category>(["hardware", "software"]);
  return device.has(ticketCategory) && device.has(reportedCategory);
}
