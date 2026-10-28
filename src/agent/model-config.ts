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

/**
 * Preço por milhão de tokens (US$), o mesmo da tabela do benchmark (docs/benchmark/RELATORIO.md).
 * Serve para estimar o custo nos indicadores; modelo fora da tabela fica sem estimativa.
 */
const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "google/gemini-3.5-flash": { input: 1.5, output: 9 },
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
};

export function pricePerToken(model: string): { input: number; output: number } | null {
  const price = PRICE_PER_MILLION[model];
  return price ? { input: price.input / 1e6, output: price.output / 1e6 } : null;
}

export function providerOf(model: string): string {
  return model.split("/")[0];
}

/** Chave obrigatória para o modelo, ou null se o provedor não está mapeado aqui. */
export function apiKeyVarFor(model: string): ApiKeyVar | null {
  const provider = providerOf(model);
  return provider in API_KEY_BY_PROVIDER ? API_KEY_BY_PROVIDER[provider as keyof typeof API_KEY_BY_PROVIDER] : null;
}

/** A chave que falta para o modelo configurado, ou null se está tudo certo. */
export function missingApiKey(model: string, env: Partial<Record<ApiKeyVar, string>>): ApiKeyVar | null {
  const keyVar = apiKeyVarFor(model);
  return keyVar && !env[keyVar] ? keyVar : null;
}

/**
 * O que o chat responde quando falta a chave. Rodando local, diz o que configurar;
 * no deploy, quem lê é o funcionário: a variável vai só para o log do servidor.
 */
export function missingKeyMessage(keyVar: ApiKeyVar, production: boolean): string {
  return production
    ? "O Nexo Assist está indisponível no momento. Tente de novo mais tarde."
    : `O Nexo Assist não está configurado neste ambiente: defina ${keyVar} no .env e reinicie o servidor.`;
}

type ProviderOptions =
  | { google: { thinkingConfig: { thinkingLevel: "minimal" } } }
  | { openrouter: { reasoning: { effort: ReasoningEffort }; session_id: string } };

/**
 * Opções do provedor para cada chamada ao modelo. No OpenRouter, `session_id`
 * (a conversa) mantém os turnos no mesmo provedor, onde o cache do prompt está quente.
 */
export function providerOptionsFor(model: string, openRouterEffort: ReasoningEffort, sessionId: string): ProviderOptions | undefined {
  switch (providerOf(model)) {
    case "google":
      // Atendimento precisa de resposta rápida, não de raciocínio longo.
      return { google: { thinkingConfig: { thinkingLevel: "minimal" } } };
    case "openrouter":
      return { openrouter: { reasoning: { effort: openRouterEffort }, session_id: sessionId } };
    default:
      return undefined;
  }
}
