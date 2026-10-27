/**
 * O que muda conforme o provedor do LLM_MODEL ("provedor/modelo" do roteador do Mastra):
 * qual chave precisa existir e como pedir "raciocínio mínimo".
 *
 * Gemini direto (padrão em produção) usa o thinkingLevel do Google; pelo OpenRouter
 * o mesmo pedido vira reasoning.effort, que o OpenRouter traduz para cada modelo.
 */

/** Variável de ambiente com a chave de cada provedor (o Mastra lê a mesma). */
const API_KEY_BY_PROVIDER = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
} as const;

export type ApiKeyVar = (typeof API_KEY_BY_PROVIDER)[keyof typeof API_KEY_BY_PROVIDER];

/** Níveis de raciocínio aceitos pelo OpenRouter ("none" desliga). */
export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function providerOf(model: string): string {
  return model.split("/")[0];
}

/** Chave obrigatória para o modelo, ou null se o provedor não está mapeado aqui. */
export function apiKeyVarFor(model: string): ApiKeyVar | null {
  const provider = providerOf(model);
  return provider in API_KEY_BY_PROVIDER ? API_KEY_BY_PROVIDER[provider as keyof typeof API_KEY_BY_PROVIDER] : null;
}

type ProviderOptions =
  | { google: { thinkingConfig: { thinkingLevel: "minimal" } } }
  | { openrouter: { reasoning: { effort: ReasoningEffort } } };

/** Opções do provedor para cada chamada ao modelo. */
export function providerOptionsFor(model: string, openRouterEffort: ReasoningEffort): ProviderOptions | undefined {
  switch (providerOf(model)) {
    case "google":
      // Atendimento precisa de resposta rápida, não de raciocínio longo.
      return { google: { thinkingConfig: { thinkingLevel: "minimal" } } };
    case "openrouter":
      return { openrouter: { reasoning: { effort: openRouterEffort } } };
    default:
      return undefined;
  }
}
