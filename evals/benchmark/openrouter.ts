/**
 * Cliente mínimo da API do OpenRouter, com Zod na fronteira: o que vem da rede
 * é validado antes de virar dado do benchmark. A chave nunca é impressa.
 *
 * Endpoints usados (docs: https://openrouter.ai/docs/api-reference):
 *   GET  /models                  catálogo: preço por token e parâmetros suportados
 *   GET  /models/{id}/endpoints   o mesmo, por provedor que serve o modelo
 *   GET  /key                     limite e uso da chave (gasto real)
 *   POST /chat/completions        juízes e pré-voo; `usage.cost` vem em toda resposta
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { appendJsonl, readJsonl, RESULTS_DIR } from "./records";

const API = "https://openrouter.ai/api/v1";

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY não configurada (veja .env.example).");
  return key;
}

/** US$ por token. Leitura/escrita de cache só existem para modelos que fazem cache. */
export const pricingSchema = z.object({
  prompt: z.coerce.number(),
  completion: z.coerce.number(),
  input_cache_read: z.coerce.number().optional(),
  input_cache_write: z.coerce.number().optional(),
});
export type Pricing = z.infer<typeof pricingSchema>;

const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  context_length: z.number().nullable(),
  pricing: pricingSchema,
  supported_parameters: z.array(z.string()).default([]),
});
export type CatalogModel = z.infer<typeof modelSchema>;

const endpointSchema = z.object({
  provider_name: z.string(),
  pricing: pricingSchema,
  supported_parameters: z.array(z.string()).default([]),
  status: z.number().nullish(),
});
export type Endpoint = z.infer<typeof endpointSchema>;

const keySchema = z.object({
  data: z.object({
    limit: z.number().nullable(),
    limit_remaining: z.number().nullable(),
    usage: z.number(),
  }),
});
export type KeyInfo = z.infer<typeof keySchema>["data"];

const logprobSchema = z.object({
  token: z.string(),
  logprob: z.number(),
  top_logprobs: z.array(z.object({ token: z.string(), logprob: z.number() })).default([]),
});
export type TokenLogprob = z.infer<typeof logprobSchema>;

const usageSchema = z.object({
  prompt_tokens: z.number().default(0),
  completion_tokens: z.number().default(0),
  cost: z.number().default(0),
  prompt_tokens_details: z.object({ cached_tokens: z.number().nullish() }).nullish(),
  completion_tokens_details: z.object({ reasoning_tokens: z.number().nullish() }).nullish(),
});

const completionSchema = z.object({
  id: z.string().optional(),
  provider: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z.array(z.object({ function: z.object({ name: z.string() }) })).nullish(),
        }),
        logprobs: z.object({ content: z.array(logprobSchema).nullish() }).nullish(),
      }),
    )
    .default([]),
  usage: usageSchema.optional(),
  error: z.object({ message: z.string() }).optional(),
});

export interface Completion {
  ok: boolean;
  status: number;
  provider: string | null;
  text: string;
  toolCalls: string[];
  logprobs: TokenLogprob[];
  /** Custo cobrado quando a resposta foi gerada (num acerto do cache local, nada é cobrado de novo). */
  costUsd: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  error: string | null;
  /** true = veio do cache local de respostas, sem chamar a API. */
  fromCache: boolean;
}

async function getJson(path: string, auth: boolean): Promise<unknown> {
  const response = await fetch(`${API}${path}`, auth ? { headers: { Authorization: `Bearer ${apiKey()}` } } : undefined);
  if (!response.ok) throw new Error(`OpenRouter ${path}: HTTP ${response.status}`);
  return response.json();
}

export async function listModels(): Promise<CatalogModel[]> {
  const body = z.object({ data: z.array(z.unknown()) }).parse(await getJson("/models", false));
  // Itens que não batem com o schema (ex.: roteadores com preço -1) ficam de fora.
  return body.data.flatMap((item) => {
    const parsed = modelSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function listEndpoints(model: string): Promise<Endpoint[]> {
  const body = z.object({ data: z.object({ endpoints: z.array(endpointSchema) }) }).parse(await getJson(`/models/${model}/endpoints`, false));
  return body.data.endpoints;
}

export async function keyInfo(): Promise<KeyInfo> {
  return keySchema.parse(await getJson("/key", true)).data;
}

/**
 * Cache local de respostas, endereçado pelo conteúdo: a chave é o hash de
 * modelo + mensagens + parâmetros (+ `salt`, que separa amostras repetidas de propósito).
 * Pedido idêntico ao de uma execução anterior não é pago de novo.
 */
const RESPONSE_CACHE = `${RESULTS_DIR}/respostas.jsonl`;
const cachedResponseSchema = z.object({ key: z.string(), completion: z.custom<Completion>() });
let responseCache: Map<string, Completion> | null = null;

export function responseCacheKey(body: Record<string, unknown>, salt = ""): string {
  return createHash("sha256").update(JSON.stringify(body)).update(salt).digest("hex").slice(0, 32);
}

function loadResponseCache(): Map<string, Completion> {
  responseCache ??= new Map(readJsonl(RESPONSE_CACHE, cachedResponseSchema).map((r) => [r.key, r.completion]));
  return responseCache;
}

/** Chat com o cache local: devolve a resposta guardada ou chama a API e guarda se deu certo. */
export async function cachedChat(body: Record<string, unknown>, salt = ""): Promise<Completion> {
  const key = responseCacheKey(body, salt);
  const hit = loadResponseCache().get(key);
  if (hit) return { ...hit, fromCache: true };
  const result = await chat(body);
  if (result.ok) {
    // As alternativas só importam nos dígitos da nota; nos outros tokens basta o texto.
    const logprobs = result.logprobs.map((t) => (/[1-5]/.test(t.token) ? t : { ...t, top_logprobs: [] }));
    loadResponseCache().set(key, result);
    appendJsonl(RESPONSE_CACHE, { key, completion: { ...result, logprobs } });
  }
  return result;
}

/** Uma chamada de chat sem streaming. Erro HTTP vira `ok: false` com a mensagem, não exceção. */
export async function chat(body: Record<string, unknown>, timeoutMs = 120_000): Promise<Completion> {
  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const parsed = completionSchema.safeParse(await response.json().catch(() => ({})));
  const data = parsed.success ? parsed.data : { choices: [], usage: undefined, error: { message: "resposta fora do formato" } };
  const choice = data.choices[0];
  return {
    ok: response.ok && !data.error && !!choice,
    status: response.status,
    provider: "provider" in data ? (data.provider ?? null) : null,
    text: choice?.message.content ?? "",
    toolCalls: choice?.message.tool_calls?.map((call) => call.function.name) ?? [],
    logprobs: choice?.logprobs?.content ?? [],
    costUsd: data.usage?.cost ?? 0,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    error: data.error?.message ?? (response.ok ? null : `HTTP ${response.status}`),
    fromCache: false,
  };
}
