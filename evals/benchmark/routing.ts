/**
 * Simulação offline de um roteador em cascata: o modelo barato faz o passo 0
 * (recordUnderstanding) e, se o gatilho disparar, a conversa sobe para o modelo
 * maior. Usa só as conversas já gravadas pelo benchmark — não chama API nenhuma.
 * O gatilho é validado contra o rótulo humano: o que cada cenário espera, escrito à mão.
 * Funções puras — o mesmo cache sempre gera os mesmos números.
 */
import type { NexoToolName } from "@/agent/tools";
import { LOW_CONFIDENCE } from "@/domain/conversation";
import type { Intent } from "@/domain/message";
import type { Scenario } from "../scenarios";
import { BUSINESS } from "./config";
import type { ConversationRecord, TurnRecord } from "./records";
import { bootstrapMean, percentile, type Interval } from "./stats";

/** Ferramentas que escrevem chamado: o cenário que espera uma delas é de risco. */
export const WRITE_TOOLS: readonly NexoToolName[] = ["draftNewTicket", "draftTicketUpdate", "confirmDraft"];

export interface Trigger {
  /** Intenções do passo 0 que sobem para o modelo maior. */
  intents: readonly string[];
  /** Abaixo desta confiança, sobe em qualquer intenção. */
  minConfidence: number;
}

/** Sobe o que leva a escrever chamado ou o que o modelo não entendeu; confiança baixa é a mesma regra do domínio. */
export const DEFAULT_TRIGGER: Trigger = {
  intents: ["new_ticket", "ticket_update", "confirm_or_choose", "unclear"] satisfies Intent[],
  minConfidence: LOW_CONFIDENCE,
};

type Decision = Pick<NonNullable<TurnRecord["decision"]>, "intent" | "confidence"> | null;

export function shouldEscalate(decision: Decision, trigger: Trigger): boolean {
  if (!decision) return true;
  return trigger.intents.includes(decision.intent) || decision.confidence < trigger.minConfidence;
}

/** Rótulo humano: o cenário espera que o agent escreva um chamado. */
export const scenarioNeedsWrite = (scenario: Scenario) => (scenario.expect.anyTool ?? []).some((tool) => WRITE_TOOLS.includes(tool));

export interface RoutedConversation {
  scenario: string;
  rep: number;
  escalated: boolean;
  passed: boolean;
  costUsd: number;
  turnLatenciesMs: number[];
}

const pairKey = (c: { scenario: string; rep: number }) => `${c.scenario}|${c.rep}`;
const conversationCostUsd = (c: ConversationRecord) =>
  c.turns.flatMap((t) => t.llmCalls).reduce((sum, call) => sum + call.costUsd, 0) + c.discardedCostUsd;
/** O passo 0 do barato: a 1ª chamada do 1º turno, a que registra a intenção. */
const stepZero = (c: ConversationRecord) => c.turns[0]?.llmCalls[0] ?? { costUsd: 0, latencyMs: 0 };

const keep = (c: ConversationRecord): RoutedConversation => ({
  scenario: c.scenario,
  rep: c.rep,
  escalated: false,
  passed: c.failures.length === 0,
  costUsd: conversationCostUsd(c),
  turnLatenciesMs: c.turns.map((t) => t.latencyMs),
});

/**
 * Decide pela intenção do 1º turno do barato. Quando sobe, a conversa inteira é a do
 * forte (mesmo cenário e repetição), mais o custo e a espera do passo 0 já gasto.
 */
export function simulateCascade(cheap: ConversationRecord[], strong: ConversationRecord[], trigger: Trigger): RoutedConversation[] {
  const strongByPair = new Map(strong.map((c) => [pairKey(c), c]));
  return cheap.map((c) => {
    if (!shouldEscalate(c.turns[0]?.decision ?? null, trigger)) return keep(c);
    const target = strongByPair.get(pairKey(c));
    if (!target) throw new Error(`Sem conversa do modelo maior para ${pairKey(c)}`);
    const step = stepZero(c);
    const routed = keep(target);
    return {
      ...routed,
      escalated: true,
      costUsd: routed.costUsd + step.costUsd,
      turnLatenciesMs: routed.turnLatenciesMs.map((ms, i) => (i === 0 ? ms + step.latencyMs : ms)),
    };
  });
}

/** Um modelo só, sem roteador: a linha de base. */
export const single = (conversations: ConversationRecord[]) => conversations.map(keep);

export interface RoutingSummary {
  conversations: number;
  passRate: Interval;
  escalationRate: number;
  per1000AtendimentosUsd: number;
  latency: { p50: number; p95: number };
}

export function summarizeRouting(routed: RoutedConversation[]): RoutingSummary {
  const latencies = routed.flatMap((r) => r.turnLatenciesMs);
  const totalUsd = routed.reduce((sum, r) => sum + r.costUsd, 0);
  return {
    conversations: routed.length,
    passRate: bootstrapMean(routed.map((r) => (r.passed ? 1 : 0))),
    escalationRate: routed.filter((r) => r.escalated).length / routed.length,
    per1000AtendimentosUsd: (totalUsd / latencies.length) * BUSINESS.turnsPerAtendimento * 1000,
    latency: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
  };
}

export interface TriggerConfusion {
  /** De risco e subiu. */
  tp: number;
  /** De risco e ficou no barato: o erro que custa qualidade. */
  fn: number;
  /** Sem risco e subiu: só custa dinheiro. */
  fp: number;
  tn: number;
  missed: string[];
}

/**
 * Compara o gatilho com o rótulo humano. "first" decide só pelo 1º turno (o que a
 * cascata simulada faz); "any" dispara se qualquer turno do barato disparar (roteador turno a turno).
 */
export function triggerConfusion(
  cheap: ConversationRecord[],
  needsWrite: Map<string, boolean>,
  trigger: Trigger,
  mode: "first" | "any",
): TriggerConfusion {
  const result: TriggerConfusion = { tp: 0, fn: 0, fp: 0, tn: 0, missed: [] };
  for (const c of cheap) {
    const label = needsWrite.get(c.scenario);
    if (label === undefined) throw new Error(`Cenário sem rótulo: ${c.scenario}`);
    const turns = mode === "first" ? c.turns.slice(0, 1) : c.turns;
    const fired = turns.some((t) => shouldEscalate(t.decision, trigger));
    if (label && fired) result.tp++;
    else if (label) {
      result.fn++;
      result.missed.push(c.scenario);
    } else if (fired) result.fp++;
    else result.tn++;
  }
  return result;
}
