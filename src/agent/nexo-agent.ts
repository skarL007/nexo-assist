import { Agent } from "@mastra/core/agent";
import { env } from "@/config/env";
import { NEXO_INSTRUCTIONS } from "./instructions";
import { nexoTools } from "./tools";

let agent: Agent | null = null;

/** O agent é criado na primeira chamada, depois que as variáveis de ambiente existem. */
export function nexoAgent(): Agent {
  agent ??= new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: NEXO_INSTRUCTIONS,
    model: env().LLM_MODEL,
    tools: nexoTools,
  });
  return agent;
}
