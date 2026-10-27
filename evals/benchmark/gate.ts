/**
 * Porta de entrada (pré-voo): o agent FORÇA a tool recordUnderstanding no passo 0
 * (prepareStep + toolChoice). Um modelo/provedor que não aceita tool_choice forçado
 * quebra a transparência do produto — é desqualificado antes de gastar com cenários.
 * Custa frações de centavo por candidato.
 */
import type { Candidate } from "./config";
import { chat } from "./openrouter";

export interface GateResult {
  candidate: string;
  model: string;
  effort: string;
  passed: boolean;
  toolCalled: string | null;
  provider: string | null;
  error: string | null;
  costUsd: number;
  checkedAt: string;
}

const RECORD_UNDERSTANDING = {
  type: "function",
  function: {
    name: "recordUnderstanding",
    description: "Registra o que você entendeu da última mensagem do funcionário, antes de agir.",
    parameters: {
      type: "object",
      properties: { intent: { type: "string" }, understanding: { type: "string" }, confidence: { type: "number" } },
      required: ["intent", "understanding", "confidence"],
    },
  },
};

export async function forcedToolGate(candidate: Candidate): Promise<GateResult> {
  // Mesmos parâmetros que o agent manda em produção (temperatura, raciocínio, tool forçada).
  const result = await chat({
    model: candidate.model,
    messages: [{ role: "user", content: "Qual o horário do service desk?" }],
    tools: [RECORD_UNDERSTANDING],
    tool_choice: { type: "function", function: { name: "recordUnderstanding" } },
    temperature: 0.2,
    max_tokens: 300,
    reasoning: { effort: candidate.effort },
  });
  const toolCalled = result.toolCalls[0] ?? null;
  return {
    candidate: candidate.key,
    model: candidate.model,
    effort: candidate.effort,
    passed: result.ok && toolCalled === "recordUnderstanding",
    toolCalled,
    provider: result.provider,
    error: result.error ?? (toolCalled === "recordUnderstanding" ? null : "não chamou a tool forçada"),
    costUsd: result.costUsd,
    checkedAt: new Date().toISOString(),
  };
}
