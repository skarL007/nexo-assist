/**
 * Contexto de um turno (uma mensagem do funcionário → uma resposta do agent).
 *
 * Viaja até as tools pelo RequestContext do Mastra. Detalhe de segurança:
 * o funcionário vem da sessão (cookie assinado), nunca de um argumento que o
 * modelo preenche — assim nenhum prompt consegue ler chamados de outra pessoa.
 */
import type { Employee } from "@/domain/employee";
import type { Card, Decision, TraceStep } from "@/domain/message";
import type { Services } from "@/infrastructure/container";

export type RecorderEvent = { type: "step"; step: TraceStep } | { type: "card"; card: Card };

/** Junta o que o agent fez no turno: vira os passos visíveis e o trace salvo. */
export class TurnRecorder {
  decision: Decision | null = null;
  handedOff = false;
  /** Baixa confiança pela primeira vez: o turno só pode fazer uma pergunta. */
  clarifying = false;
  readonly steps: TraceStep[] = [];
  readonly cards: Card[] = [];
  readonly guardrails: string[] = [];
  private pending: RecorderEvent[] = [];

  step(label: string, detail?: string, ok = true) {
    const step: TraceStep = { label, detail, ok };
    this.steps.push(step);
    this.pending.push({ type: "step", step });
  }

  card(card: Card) {
    this.cards.push(card);
    this.pending.push({ type: "card", card });
  }

  guardrail(note: string) {
    this.guardrails.push(note);
  }

  /** Eventos ainda não enviados ao browser. */
  drain(): RecorderEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}

export interface TurnContext {
  employee: Employee;
  conversationId: string;
  startedAt: Date;
  services: Services;
  recorder: TurnRecorder;
}

export const TURN_KEY = "turn";

interface HasRequestContext {
  requestContext?: { get(key: string): unknown };
}

export function turnFrom(context: HasRequestContext | undefined): TurnContext {
  const turn = context?.requestContext?.get(TURN_KEY) as TurnContext | undefined;
  if (!turn) throw new Error("Tool chamada fora de um turno do Nexo Assist.");
  return turn;
}
