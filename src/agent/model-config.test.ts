import { describe, expect, it } from "vitest";
import { apiKeyVarFor, providerOptionsFor } from "./model-config";

describe("configuração por provedor do modelo", () => {
  it("Gemini direto (padrão de produção) continua com thinkingLevel mínimo e chave do Google", () => {
    expect(apiKeyVarFor("google/gemini-3.5-flash")).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(providerOptionsFor("google/gemini-3.5-flash", "minimal", "c1")).toEqual({
      google: { thinkingConfig: { thinkingLevel: "minimal" } },
    });
  });

  it("OpenRouter: própria chave, raciocínio em reasoning.effort e a conversa como sessão (cache quente)", () => {
    expect(apiKeyVarFor("openrouter/qwen/qwen3.8-flash")).toBe("OPENROUTER_API_KEY");
    expect(providerOptionsFor("openrouter/qwen/qwen3.8-flash", "none", "c1")).toEqual({
      openrouter: { reasoning: { effort: "none" }, session_id: "c1" },
    });
  });

  it("provedor não mapeado não exige chave aqui nem recebe opções", () => {
    expect(apiKeyVarFor("openai/gpt-6-luna")).toBeNull();
    expect(providerOptionsFor("openai/gpt-6-luna", "minimal", "c1")).toBeUndefined();
  });
});
