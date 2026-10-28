/**
 * Contrato entre o servidor e o browser: formato das respostas da API
 * e dos eventos do stream do chat. Tipos puros + schemas Zod dos pedidos.
 */
import { z } from "zod";
import type { ConversationStatus, HandoffReason } from "@/domain/conversation";
import type { Card, ChatMessage, DraftStatus, TicketSnapshot, TraceStep } from "@/domain/message";
import { DRAFT_LIMITS } from "@/domain/draft-revision";
import { URGENCIES } from "@/domain/priority";
import { CATEGORIES, IMPACTS, TICKET_TYPES } from "@/domain/ticket";

export interface ConversationView {
  /** null enquanto o funcionário ainda não mandou a primeira mensagem. */
  id: string | null;
  status: ConversationStatus;
  analystName: string | null;
  remainingMessages: number;
  messageLimit: number;
  draftStatuses: Record<number, DraftStatus>;
  /** "Isso resolveu?": id da resposta do agent → avaliação do funcionário. */
  feedback: Record<string, boolean>;
  messages: ChatMessage[];
}

/** Alerta de prazo (vencido ou em risco) com a explicação da conta, pronto para mostrar. */
export interface SlaAlertView {
  code: string;
  title: string;
  level: "at_risk" | "overdue";
  headline: string;
  lines: string[];
}

export const feedbackSchema = z.strictObject({
  messageId: z.string().min(1).max(100),
  helpful: z.boolean(),
});

/** Eventos do stream (um JSON por linha — NDJSON). */
export type ChatStreamEvent =
  | { type: "employee_message"; message: ChatMessage }
  | { type: "step"; step: TraceStep }
  | { type: "card"; card: Card }
  | { type: "text"; delta: string }
  | { type: "done"; conversation: ConversationView }
  | { type: "error"; message: string };

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, "Escreva uma mensagem").max(2000),
});

const newTicketEditSchema = z
  .object({
    type: z.enum(TICKET_TYPES),
    category: z.enum(CATEGORIES),
    title: z.string().trim().min(DRAFT_LIMITS.title[0], "O título precisa de pelo menos 5 letras.").max(DRAFT_LIMITS.title[1]),
    description: z.string().trim().min(DRAFT_LIMITS.description[0], "Descreva com pelo menos 20 letras.").max(DRAFT_LIMITS.description[1]),
    impact: z.enum(IMPACTS),
    urgency: z.enum(URGENCIES),
  })
  .strict();

const commentEditSchema = z
  .object({ comment: z.string().trim().min(DRAFT_LIMITS.comment[0], "Escreva pelo menos 5 letras.").max(DRAFT_LIMITS.comment[1]) })
  .strict();

/** Botões do rascunho. "edit" é o "Alterar detalhes": a prioridade nunca vem do navegador. */
export const draftActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("edit"), fields: z.union([newTicketEditSchema, commentEditSchema]) }),
]);
export type DraftAction = z.infer<typeof draftActionSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido")
    .refine((email) => email.endsWith("@nexo.com.br"), "Use seu e-mail corporativo @nexo.com.br"),
  password: z.string().min(1, "Informe uma senha (na demonstração, qualquer uma funciona)"),
  /** "Manter conectado neste computador": sessão de 7 dias em vez de terminar com o navegador. */
  remember: z.boolean().default(false),
});

// ── Console do analista ──

export interface ConsoleConversationSummary {
  id: string;
  employee: { id: string; name: string; department: string };
  status: ConversationStatus;
  analyst: { id: string; name: string } | null;
  handoffReason: HandoffReason | null;
  handoffConfidence: number | null;
  handoffAt: string | null;
  lastMessage: { role: ChatMessage["role"]; text: string; at: string } | null;
  ticketCode: string | null;
}

export interface ConsoleConversationDetail extends ConsoleConversationSummary {
  handoffSummary: string | null;
  messages: ChatMessage[];
  /** Status atual de cada rascunho (o relatório usa para saber o que ainda espera confirmação). */
  draftStatuses: Record<number, DraftStatus>;
  /** Avaliações do funcionário ("Isso resolveu?"), para o analista ver o que não funcionou. */
  feedback: Record<string, boolean>;
  /** Chamados do funcionário com prazo vencido ou em risco, com o porquê. */
  slaAlerts: SlaAlertView[];
  /** null: o sistema de chamados não respondeu agora (o console tenta de novo no próximo polling). */
  tickets: TicketSnapshot[] | null;
}

export const consoleActionSchema = z.object({
  action: z.enum(["assume", "release", "close"]),
});
