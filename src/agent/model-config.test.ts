import { describe, expect, it } from "vitest";
import { apiKeyVarFor, missingApiKey, missingKeyMessage, pricePerToken, providerOptionsFor } from "./model-config";

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

describe("chave do modelo ausente", () => {
  it("diz qual variável falta, para a tela explicar em vez de um \"tente de novo\" genérico", () => {
    // Achado da auditoria: sem chave, o avaliador via "Não consegui responder agora" e o selo "online".
    expect(missingApiKey("google/gemini-3.5-flash", {})).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(missingApiKey("google/gemini-3.5-flash", { GOOGLE_GENERATIVE_AI_API_KEY: "x" })).toBeNull();
    expect(missingApiKey("openai/gpt-6-luna", {})).toBeNull();
  });
});

describe("mensagem quando falta a chave", () => {
  it("no deploy, não revela a configuração ao funcionário (achado N1 da auditoria de segurança)", () => {
    const text = missingKeyMessage("GOOGLE_GENERATIVE_AI_API_KEY", true);
    expect(text).not.toContain("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(text).not.toContain(".env");
    expect(text).toContain("indisponível");
  });

  it("rodando local, diz ao avaliador o que configurar", () => {
    expect(missingKeyMessage("GOOGLE_GENERATIVE_AI_API_KEY", false)).toContain("defina GOOGLE_GENERATIVE_AI_API_KEY no .env");
  });
});

describe("preço para estimar custo nos indicadores", () => {
  it("Gemini 3.5 Flash: US$ 1,50 e US$ 9,00 por milhão de tokens; modelo sem tabela fica sem estimativa", () => {
    expect(pricePerToken("google/gemini-3.5-flash")).toEqual({ input: 1.5e-6, output: 9e-6 });
    expect(pricePerToken("openrouter/qualquer/modelo")).toBeNull();
  });
});
