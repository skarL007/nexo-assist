import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddingHttpError } from "@/application/provider-breaker";
import { OpenRouterEmbedder } from "./openrouter-embedder";

afterEach(() => vi.unstubAllGlobals());

describe("embeddings pelo OpenRouter", () => {
  it("pede o modelo com 768 dimensões, com a chave no cabeçalho, e devolve na ordem do índice", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }),
    );
    vi.stubGlobal("fetch", fetch);

    const embedder = new OpenRouterEmbedder("google/gemini-embedding-2", "chave-de-teste");
    expect(embedder.model).toBe("openrouter/google/gemini-embedding-2");
    expect(await embedder.embed(["vpn", "wifi"])).toEqual([[1, 0], [0, 1]]);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/embeddings");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer chave-de-teste");
    expect(JSON.parse(String(init?.body))).toEqual({ model: "google/gemini-embedding-2", input: ["vpn", "wifi"], dimensions: 768, encoding_format: "float" });
  });

  it("erro HTTP vira EmbeddingHttpError com o status (o disjuntor decide quanto esperar)", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 402 }));
    await expect(new OpenRouterEmbedder("google/gemini-embedding-2", "k").embed(["vpn"])).rejects.toEqual(new EmbeddingHttpError(402));
  });

  it("resposta com menos vetores do que textos é erro, não busca pela metade", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ data: [{ index: 0, embedding: [1, 0] }] }));
    await expect(new OpenRouterEmbedder("google/gemini-embedding-2", "k").embed(["vpn", "wifi"])).rejects.toThrow("resposta incompleta");
  });
});
