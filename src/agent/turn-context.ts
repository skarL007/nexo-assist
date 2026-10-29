/**
 * Contexto de um turno (uma mensagem do funcionário → uma resposta do agent).
 *
 * Viaja até as tools pelo RequestContext do Mastra. Detalhe de segurança:
 * o funcionário vem da sessão (cookie assinado), nunca de um argumento que o
 * modelo preenche — assim nenhum prompt consegue ler chamados de outra pessoa.
 */
import type { Employee } from "@/domain/employee";
import { OFFER_ANALYST_OPTION } from "@/domain/frustration";
import type { Card, Decision, TraceStep } from "@/domain/message";
import type { Services } from "@/infrastructure/container";

export type RecorderEvent = { type: "step"; step: TraceStep } | { type: "card"; card: Card };

/** Junta o que o agent fez no turno: vira os passos visíveis e o trace salvo. */
export class TurnRecorder {
  decision: Decision | null = null;
  /** Chamadas extras de recordUnderstanding no mesmo turno (o Gemini às vezes manda várias em paralelo). */
  repeatedUnderstandings = 0;
  handedOff = false;
  /** Baixa confiança pela primeira vez: o turno só pode fazer uma pergunta. */
  clarifying = false;
  readonly steps: TraceStep[] = [];
  readonly cards: Card[] = [];
  readonly guardrails: string[] = [];
  private pending: RecorderEvent[] = [];

  /** Registra o entendimento; devolve false (e conta) se o turno já tinha um. Sem await: chamadas paralelas não passam juntas. */
  recordDecision(decision: Decision): boolean {
    if (this.decision) {
      this.repeatedUnderstandings++;
      return false;
    }
    this.decision = decision;
    return true;
  }

  step(label: string, detail?: string, ok = true) {
    const step: TraceStep = { label, detail, ok };
    this.steps.push(step);
    this.pending.push({ type: "step", step });
  }

  /** Regra do código (frustração, prazo que não atende): o turno termina oferecendo um analista (botão), sem transferir. */
  offerAnalyst = false;
  /** O prazo de um chamado consultado neste turno atende a necessidade informada: sem oferta de analista por prazo. */
  deadlineCoversNeed = false;
  /** Um chamado consultado neste turno está vencido: o botão de analista que o modelo puser vale. */
  overdueSeen = false;

  /**
   * Fecha a oferta de analista do turno. Com motivo do código, o botão aparece mesmo que a
   * resposta esqueça de oferecer. Sem motivo (prazo que não atende, chamado vencido consultado
   * no turno, frustração), o botão de analista sai das respostas rápidas (pedido explícito do
   * funcionário continua transferindo).
   */
  finishAnalystOffer() {
    if (this.handedOff) return;
    if (this.offerAnalyst) {
      const replies = this.cards.find((c) => c.kind === "quick_replies");
      if (!replies) this.card({ kind: "quick_replies", options: [OFFER_ANALYST_OPTION] });
      else if (!replies.options.includes(OFFER_ANALYST_OPTION)) replies.options.push(OFFER_ANALYST_OPTION);
      return;
    }
    if (this.overdueSeen && !this.deadlineCoversNeed) return;
    let removed = false;
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const card = this.cards[i];
      if (card.kind !== "quick_replies") continue;
      const kept = card.options.filter((option) => !/analista/i.test(option));
      if (kept.length === card.options.length) continue;
      removed = true;
      if (kept.length) card.options = kept;
      else this.cards.splice(i, 1);
    }
    if (removed)
      this.guardrail(
        this.deadlineCoversNeed
          ? "O prazo do chamado atende a necessidade informada: o botão de analista saiu das respostas rápidas."
          : "Oferta de analista sem motivo (prazo que não atende, chamado vencido ou frustração): o botão saiu das respostas rápidas.",
      );
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
  /** Texto da mensagem do funcionário neste turno (vem do pedido, nunca de argumento de tool). */
  employeeText: string;
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
