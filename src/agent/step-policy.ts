/**
 * Quais tools o modelo pode usar em cada passo do turno.
 * Passo 0: só recordUnderstanding. Depois, as outras: o registro é um só por turno.
 * No turno de esclarecimento (baixa confiança), só respostas rápidas: a pergunta pode
 * vir com botões, mas nada de rascunho, confirmação ou transferência.
 * Depois de transferir para um analista, nenhuma.
 */
import type { ToolCallLog } from "@/domain/message";
import { nexoTools, type NexoToolName } from "./tools";

const ACTION_TOOLS = (Object.keys(nexoTools) as NexoToolName[]).filter((name) => name !== "recordUnderstanding");

const CLARIFYING_TOOLS: NexoToolName[] = ["offerQuickReplies"];

export function stepPolicy(stepNumber: number, handedOff: boolean, clarifying = false) {
  if (stepNumber === 0) return { toolChoice: { type: "tool" as const, toolName: "recordUnderstanding" as const } };
  if (handedOff) return { toolChoice: "none" as const };
  if (clarifying) return { activeTools: CLARIFYING_TOOLS };
  return { activeTools: ACTION_TOOLS };
}

/**
 * O Gemini, obrigado a chamar recordUnderstanding, às vezes repete a chamada até o limite
 * de tokens: o passo é cortado e o turno acaba sem texto nem ação. Nesse caso, o turno
 * continua uma vez a partir do passo 1 (a decisão já foi registrada).
 */
export function needsContinuation(turn: { reply: string; handedOff: boolean; toolCalls: Pick<ToolCallLog, "tool">[] }) {
  return !turn.reply.trim() && !turn.handedOff && turn.toolCalls.every((call) => call.tool === "recordUnderstanding");
}
