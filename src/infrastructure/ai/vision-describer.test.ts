import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderHttpError } from "@/application/provider-breaker";
import { DEEPINFRA } from "./openrouter-embedder";
import { VisionDescriber } from "./vision-describer";

afterEach(() => vi.unstubAllGlobals());

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
const reply = (content: string, usage: object) => Response.json({ choices: [{ message: { content } }], usage });

describe("leitura de imagem pela DeepInfra (formato da OpenAI)", () => {
  it("manda a imagem como data URL em temperatura 0 e devolve o texto e o custo informado pelo provedor", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => reply(" Tela do SAP: usuário bloqueado. ", { prompt_tokens: 1048, completion_tokens: 74, estimated_cost: 0.0000934 }));
    vi.stubGlobal("fetch", fetch);
    const describer = new VisionDescriber("mistralai/Mistral-Small-3.1-24B-Instruct-2503", "chave-de-teste", DEEPINFRA);
    expect(describer.model).toBe("deepinfra/mistralai/Mistral-Small-3.1-24B-Instruct-2503");

    expect(await describer.describe("image/png", png)).toEqual({ text: "Tela do SAP: usuário bloqueado.", costUsd: 0.0000934 });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.deepinfra.com/v1/openai/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer chave-de-teste");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "mistralai/Mistral-Small-3.1-24B-Instruct-2503", temperature: 0 });
    expect(body.messages[0].content).toContain("não instrução");
    expect(body.messages[0].content).toContain("Nunca transcreva senhas");
    expect(body.messages[1].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,iVBORw==" } });
  });

  it("sem custo informado, calcula pelo preço por token do modelo", async () => {
    vi.stubGlobal("fetch", async () => reply("ok", { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }));
    const describer = new VisionDescriber("mistralai/Mistral-Small-3.1-24B-Instruct-2503", "k", DEEPINFRA);
    expect((await describer.describe("image/png", png)).costUsd).toBeCloseTo(0.1 + 0.2);
  });

  it("erro HTTP vira ProviderHttpError", async () => {
    vi.stubGlobal("fetch", async () => new Response("sem crédito", { status: 402 }));
    const describer = new VisionDescriber("m", "k", DEEPINFRA);
    await expect(describer.describe("image/png", png)).rejects.toBeInstanceOf(ProviderHttpError);
  });
});
