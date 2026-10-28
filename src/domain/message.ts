/**
 * Mensagens da conversa, os "cards" que aparecem nelas e o trace de decisão do agent.
 *
 * Cards guardam um retrato (snapshot) do chamado no momento da mensagem: o
 * histórico mostra o que o funcionário viu naquela hora, mesmo se o chamado mudar.
 * Datas viram string ISO porque tudo aqui é salvo como JSON e enviado ao browser.
 */
import type { Frustration } from "./frustration";
import type { HandoffReason } from "./conversation";
import type { Urgency } from "./priority";
import type { Category, Impact, Priority, TicketStatus, TicketType } from "./ticket";

export type MessageRole = "employee" | "agent" | "analyst" | "system";

export interface TicketSnapshot {
  code: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  impact: Impact;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
  overdue: boolean;
}

export type DraftKind = "create" | "update";
/** "replaced": trocado por um rascunho novo (correção); "cancelled": o funcionário descartou. */
export type DraftStatus = "pending" | "confirmed" | "cancelled" | "replaced";

export interface NewTicketFields {
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  impact: Impact;
  /** Guardada para o "Alterar detalhes" recalcular a prioridade (rascunhos antigos não têm). */
  urgency?: Urgency;
  priorityReason: string;
}

export interface TicketUpdateFields {
  ticketCode: string;
  ticketTitle: string;
  comment: string;
  reopen: boolean;
}

export type DraftSnapshot =
  | { id: number; kind: "create"; status: DraftStatus; fields: NewTicketFields; deadline: string }
  | { id: number; kind: "update"; status: DraftStatus; fields: TicketUpdateFields };

export type Card =
  | { kind: "ticket"; ticket: TicketSnapshot }
  | { kind: "ticket_choice"; tickets: TicketSnapshot[] }
  | { kind: "draft"; draft: DraftSnapshot }
  | { kind: "quick_replies"; options: string[] }
  | { kind: "handoff"; reason: HandoffReason; summary: string };

// ── Trace: o que o agent entendeu, o que fez, com que segurança e por quê ──

export const INTENTS = [
  "question",
  "ticket_status",
  "ticket_update",
  "new_ticket",
  "talk_to_analyst",
  "confirm_or_choose",
  "greeting",
  "out_of_scope",
  "unclear",
] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABEL: Record<Intent, string> = {
  question: "Tirar uma dúvida",
  ticket_status: "Consultar chamado",
  ticket_update: "Complementar chamado",
  new_ticket: "Abrir chamado",
  talk_to_analyst: "Falar com analista",
  confirm_or_choose: "Responder pergunta do agent",
  greeting: "Saudação",
  out_of_scope: "Fora do escopo de TI",
  unclear: "Não ficou claro",
};

export interface Decision {
  intent: Intent;
  understanding: string;
  confidence: number; // 0 a 1
  reasoning: string;
  /** Opcional: traces antigos não têm. */
  frustration?: Frustration;
  frustrationReason?: string;
}

/** Um passo visível ("consultou seus chamados") com o detalhe por trás dele. */
export interface TraceStep {
  label: string;
  detail?: string;
  ok: boolean;
}

/** Chamada de tool crua, para quem quiser ver o log técnico. */
export interface ToolCallLog {
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface TurnTrace {
  decision: Decision | null;
  steps: TraceStep[];
  toolCalls: ToolCallLog[];
  guardrails: string[];
  model: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  authorName: string | null;
  text: string;
  cards: Card[];
  trace: TurnTrace | null;
  createdAt: string;
}
