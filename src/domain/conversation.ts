/**
 * Conversa — máquina de estados de quem está atendendo.
 *
 *   with_agent ──handoff──▶ waiting_analyst ──assume──▶ with_analyst
 *        ▲                                                 │
 *        └─────────────────────── release ◀────────────────┘
 *   (qualquer estado aberto) ──close──▶ closed
 *
 * O agent só responde em `with_agent`. Nos outros estados ele fica pausado.
 */
import { DomainError } from "./errors";

export const CONVERSATION_STATUSES = ["with_agent", "waiting_analyst", "with_analyst", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const HANDOFF_REASONS = ["employee_request", "critical", "overdue", "low_confidence"] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  employee_request: "Funcionário pediu um analista",
  critical: "Caso crítico",
  overdue: "Chamado com prazo vencido",
  low_confidence: "Agent sem segurança para decidir",
};

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  with_agent: "Com o agent",
  waiting_analyst: "Aguardando atendente",
  with_analyst: "Com analista",
  closed: "Encerrada",
};

/** Limite de mensagens do funcionário por sessão (conversa). */
export const MESSAGE_LIMIT_PER_SESSION = 30;

/**
 * Limites por pessoa, somando todas as conversas: sem eles, bastaria abrir
 * "Nova conversa" a cada 30 mensagens para gastar o modelo à vontade.
 */
export const EMPLOYEE_MESSAGES_PER_HOUR = 40;
export const EMPLOYEE_MESSAGES_PER_DAY = 120;

/**
 * Teto total de respostas do modelo no deploy (TOTAL_AGENT_TURN_LIMIT): limita o gasto
 * da demonstração a um valor fixo. Sem teto configurado, não bloqueia.
 */
export function totalBudgetReached(modelReplies: number, limit: number | undefined): boolean {
  return limit !== undefined && modelReplies >= limit;
}

export interface Handoff {
  reason: HandoffReason;
  summary: string;
  ticketCode: string | null;
  confidence: number | null;
  at: Date;
}

export interface Conversation {
  id: string;
  employeeId: string;
  status: ConversationStatus;
  analystId: string | null;
  handoff: Handoff | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationAction = "handoff" | "assume" | "release" | "close";

const TRANSITIONS: Record<ConversationAction, { from: ConversationStatus[]; to: ConversationStatus }> = {
  handoff: { from: ["with_agent"], to: "waiting_analyst" },
  assume: { from: ["waiting_analyst", "with_agent"], to: "with_analyst" },
  release: { from: ["with_analyst", "waiting_analyst"], to: "with_agent" },
  close: { from: ["with_agent", "waiting_analyst", "with_analyst"], to: "closed" },
};

export function nextStatus(current: ConversationStatus, action: ConversationAction): ConversationStatus {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(current)) {
    throw new DomainError("invalid_transition", `Não é possível "${action}" uma conversa em "${STATUS_LABEL[current]}".`);
  }
  return rule.to;
}

export const agentCanReply = (status: ConversationStatus) => status === "with_agent";
