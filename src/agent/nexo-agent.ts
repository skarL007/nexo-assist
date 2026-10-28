import { Agent } from "@mastra/core/agent";
import { env } from "@/config/env";
import { NEXO_INSTRUCTIONS } from "./instructions";
import { missingApiKey } from "./model-config";
import { modelChain } from "./model-fallback";
import { nexoTools } from "./tools";

let agent: Agent | null = null;

/** Modelos do agent, em ordem: o principal e, se houver chave, o reserva (ver model-fallback.ts). */
export function agentModels(): { model: string; maxRetries: number }[] {
  const config = env();
  return modelChain(config.LLM_MODEL, config.LLM_FALLBACK_MODEL, (model) => !missingApiKey(model, config));
}

/** O agent é criado na primeira chamada, depois que as variáveis de ambiente existem. */
export function nexoAgent(): Agent {
  agent ??= new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: NEXO_INSTRUCTIONS,
    model: agentModels(),
    tools: nexoTools,
  });
  return agent;
}
