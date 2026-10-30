/**
 * Embeddings pelo OpenRouter (endpoint no formato da OpenAI), com a mesma chave do LLM_MODEL.
 * Com `google/gemini-embedding-2` é o mesmo modelo do Gemini direto e a mesma margem da busca
 * (docs/validacao/BUSCA.md). A chave vai no cabeçalho, e a chamada tem tempo máximo: se demorar,
 * a busca passa ao próximo provedor.
 */
import type { Embedder } from "@/application/ports";
import { EmbeddingHttpError } from "@/application/provider-breaker";

const API = "https://openrouter.ai/api/v1/embeddings";
/** 768 dimensões, como no Gemini direto. O modelo precisa aceitar `dimensions` (Gemini e text-embedding-3 aceitam). */
const DIMENSIONS = 768;
const TIMEOUT_MS = 4000;

export class OpenRouterEmbedder implements Embedder {
  /** Com o prefixo "openrouter/", os vetores em cache no banco ficam separados dos do Gemini direto. */
  readonly model: string;

  constructor(
    private readonly modelId: string,
    private readonly apiKey: string,
  ) {
    this.model = `openrouter/${modelId}`;
  }

  /** O endpoint não tem tipo de tarefa: pergunta e artigo vão do mesmo jeito, como na medição. */
  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({ model: this.modelId, input: texts, dimensions: DIMENSIONS, encoding_format: "float" }),
    });
    if (!response.ok) throw new EmbeddingHttpError(response.status);
    const body = (await response.json()) as { data?: { index: number; embedding: number[] }[] };
    if (!body.data || body.data.length !== texts.length) throw new Error("Embeddings: resposta incompleta");
    return [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
