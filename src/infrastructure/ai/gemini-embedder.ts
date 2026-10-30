/**
 * Embeddings do Gemini pela API REST (sem SDK extra). A chave vai no cabeçalho,
 * nunca na URL, e a chamada tem tempo máximo: se demorar, a busca passa ao próximo provedor.
 */
import type { Embedder } from "@/application/ports";
import { EmbeddingHttpError } from "@/application/provider-breaker";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
/** 768 dimensões: o modelo treina por camadas (Matryoshka), então o corte perde pouco e ocupa 1/4. */
const DIMENSIONS = 768;
const TIMEOUT_MS = 4000;

export class GeminiEmbedder implements Embedder {
  constructor(
    readonly model: string,
    private readonly apiKey: string,
  ) {}

  async embed(texts: string[], kind: "query" | "document"): Promise<number[][]> {
    const response = await fetch(`${API}/${this.model}:batchEmbedContents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
          taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          outputDimensionality: DIMENSIONS,
        })),
      }),
    });
    if (!response.ok) throw new EmbeddingHttpError(response.status);
    const body = (await response.json()) as { embeddings?: { values: number[] }[] };
    if (!body.embeddings || body.embeddings.length !== texts.length) throw new Error("Embeddings: resposta incompleta");
    return body.embeddings.map((e) => e.values);
  }
}
