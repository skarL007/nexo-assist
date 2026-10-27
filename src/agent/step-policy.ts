/**
 * Quais tools o modelo pode usar em cada passo do turno.
 * Passo 0: só recordUnderstanding. Depois, as outras: com ela ainda disponível,
 * o modelo às vezes repetia o registro até gastar os passos e não respondia.
 * Depois de transferir para um analista, nenhuma.
 */
import { nexoTools, type NexoToolName } from "./tools";

const ACTION_TOOLS = (Object.keys(nexoTools) as NexoToolName[]).filter((name) => name !== "recordUnderstanding");

export function stepPolicy(stepNumber: number, handedOff: boolean) {
  if (stepNumber === 0) return { toolChoice: { type: "tool" as const, toolName: "recordUnderstanding" as const } };
  if (handedOff) return { toolChoice: "none" as const };
  return { activeTools: ACTION_TOOLS };
}
