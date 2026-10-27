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
import { z } from "zod";

const API = "https://openrouter.ai/api/v1";

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY não configurada (veja .env.example).");
  return key;
}

const pricingSchema = z.object({ prompt: z.coerce.number(), completion: z.coerce.number() });

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
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
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
    outputTokens: data.usage?.completion_tokens ?? 0,
    error: data.error?.message ?? (response.ok ? null : `HTTP ${response.status}`),
  };
}
