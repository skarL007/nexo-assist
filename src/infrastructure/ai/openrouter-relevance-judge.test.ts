import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderHttpError } from "@/application/provider-breaker";
import type { Article } from "@/domain/knowledge";
import { OpenRouterRelevanceJudge } from "./openrouter-relevance-judge";

afterEach(() => vi.unstubAllGlobals());

const vpn: Article = { id: "kb-vpn", title: "VPN com erro 809", body: "Reinstale o cliente.", tags: ["vpn"] };
const wifi: Article = { id: "kb-wifi", title: "Wi-Fi corporativo", body: "Conecte na Nexo-Corp.", tags: ["wifi"] };
const reply = (content: string) => Response.json({ choices: [{ message: { content } }] });

describe("avaliador de relevância pelo OpenRouter", () => {
  it("manda a mensagem e os candidatos com id, em temperatura 0, e lê o veredito", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => reply('{"aplica": "kb-vpn", "talvez": null}'));
    vi.stubGlobal("fetch", fetch);
    const judge = new OpenRouterRelevanceJudge("google/gemini-3.5-flash-lite", "chave-de-teste");
    expect(judge.model).toBe("openrouter/google/gemini-3.5-flash-lite");
    expect(await judge.judge("erro 809", [vpn, wifi])).toEqual({ applies: "kb-vpn", maybe: null });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer chave-de-teste");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "google/gemini-3.5-flash-lite", temperature: 0 });
    expect(body.messages[1].content).toContain("Mensagem: erro 809");
    expect(body.messages[1].content).toContain("id: kb-wifi");
  });

  it("talvez, nenhum e JSON cercado de texto", async () => {
    vi.stubGlobal("fetch", async () => reply('Resposta: {"aplica": null, "talvez": "kb-wifi"}'));
    expect(await new OpenRouterRelevanceJudge("m", "k").judge("wifi", [vpn, wifi])).toEqual({ applies: null, maybe: "kb-wifi" });
    vi.stubGlobal("fetch", async () => reply('{"aplica": null, "talvez": null}'));
    expect(await new OpenRouterRelevanceJudge("m", "k").judge("holerite", [vpn])).toEqual({ applies: null, maybe: null });
  });

  it("erro HTTP vira ProviderHttpError com o status; resposta sem JSON é erro", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 402 }));
    await expect(new OpenRouterRelevanceJudge("m", "k").judge("vpn", [vpn])).rejects.toEqual(new ProviderHttpError(402, "Avaliador"));
    vi.stubGlobal("fetch", async () => reply("não sei"));
    await expect(new OpenRouterRelevanceJudge("m", "k").judge("vpn", [vpn])).rejects.toThrow("sem JSON");
  });
});
