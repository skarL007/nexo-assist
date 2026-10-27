/**
 * Medidor de custo real: observa as respostas do OpenRouter que passam pelo `fetch`
 * do processo, sem mudar o código de produção do agent.
 *
 * Cada passo do agent é uma chamada ao modelo. O OpenRouter manda em toda resposta
 * (no último evento do stream) o `usage` com o custo cobrado em US$. Daqui saem:
 * custo e tokens por chamada, provedor que atendeu, tools que o modelo pediu e erros.
 */

export interface LlmCall {
  status: number;
  provider: string | null;
  costUsd: number;
  inputTokens: number;
  /** Tokens de entrada lidos do cache do provedor (cobrados com desconto). */
  cachedTokens: number;
  /** Tokens gravados no cache nesta chamada (alguns provedores cobram a escrita). */
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /** Tools que o modelo pediu nesta chamada (válidas ou não). */
  toolCalls: string[];
  finishReason: string | null;
  error: string | null;
  latencyMs: number;
}

type ParsedCall = Omit<LlmCall, "status" | "latencyMs">;

interface Chunk {
  provider?: string;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number | null; cache_write_tokens?: number | null } | null;
    completion_tokens_details?: { reasoning_tokens?: number | null } | null;
  };
  choices?: Array<{
    finish_reason?: string | null;
    delta?: { tool_calls?: Array<{ function?: { name?: string } }> };
    message?: { tool_calls?: Array<{ function?: { name?: string } }> };
  }>;
}

/** Lê o corpo de uma resposta do OpenRouter: stream SSE ("data: {...}") ou JSON único. */
export function parseOpenRouterBody(body: string): ParsedCall {
  const result: ParsedCall = {
    provider: null,
    costUsd: 0,
    inputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    toolCalls: [],
    finishReason: null,
    error: null,
  };
  const isStream = /^data:/m.test(body);
  const chunks: Chunk[] = isStream
    ? body
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter((payload) => payload && payload !== "[DONE]")
        .flatMap((payload) => tryParse(payload))
    : tryParse(body);

  for (const chunk of chunks) {
    if (chunk.error) result.error = chunk.error.message ?? "erro sem mensagem";
    if (chunk.provider) result.provider = chunk.provider;
    if (chunk.usage) {
      result.costUsd = chunk.usage.cost ?? 0;
      result.inputTokens = chunk.usage.prompt_tokens ?? 0;
      result.cachedTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
      result.cacheWriteTokens = chunk.usage.prompt_tokens_details?.cache_write_tokens ?? 0;
      result.outputTokens = chunk.usage.completion_tokens ?? 0;
      result.reasoningTokens = chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0;
    }
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) result.finishReason = choice.finish_reason;
    // No stream o nome da tool vem só no primeiro fragmento de cada chamada.
    for (const call of choice?.delta?.tool_calls ?? choice?.message?.tool_calls ?? []) {
      if (call.function?.name) result.toolCalls.push(call.function.name);
    }
  }
  return result;
}

function tryParse(text: string): Chunk[] {
  try {
    return [JSON.parse(text) as Chunk];
  } catch {
    return [];
  }
}

export interface CostMeter {
  /** Espera as leituras pendentes e devolve as chamadas desde o último `take`. */
  take(): Promise<LlmCall[]>;
}

/**
 * Instala o medidor no `fetch` global. Só olha URLs do OpenRouter; o resto passa direto.
 * `onRequest` recebe o corpo enviado (usado para conferir a ordem do prompt).
 */
export function installCostMeter(onRequest?: (body: string) => void): CostMeter {
  const original = globalThis.fetch;
  let calls: LlmCall[] = [];
  const pending = new Set<Promise<void>>();

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://openrouter.ai/api/")) return original(input, init);
    if (onRequest && typeof init?.body === "string") onRequest(init.body);

    const startedAt = performance.now();
    const response = await original(input, init);
    // Lê uma cópia em paralelo: o Mastra consome o original sem atraso.
    const reading = response
      .clone()
      .text()
      .then((body) => {
        calls.push({ ...parseOpenRouterBody(body), status: response.status, latencyMs: performance.now() - startedAt });
      })
      .catch(() => undefined)
      .finally(() => pending.delete(reading));
    pending.add(reading);
    return response;
  };

  return {
    async take() {
      await Promise.all([...pending]);
      const taken = calls;
      calls = [];
      return taken;
    },
  };
}
