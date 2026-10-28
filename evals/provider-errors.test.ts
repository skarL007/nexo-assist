/**
 * Só falha do provedor é repetida e contada como "erro do provedor".
 * Nada aqui chama modelo: os erros são montados à mão com o formato que o AI SDK, o Mastra,
 * o libSQL e o app produzem.
 */
import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/errors";
import { assertModelResponded, classifyEvalError, EvalHarnessError, ProviderError, retryOnProviderError } from "./provider-errors";

const apiError = (statusCode?: number, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Erro da API (${statusCode})`), { name: "AI_APICallError", statusCode, ...extra });

const messageLimit = () => new DomainError("message_limit", "Você enviou muitas mensagens em pouco tempo. Tente de novo mais tarde.");

describe("classifyEvalError", () => {
  it("limite de mensagens do app é regra do app, não provedor (o bug do log: 15 casos)", () => {
    expect(classifyEvalError(messageLimit())).toBe("domain");
    expect(classifyEvalError(new DomainError("daily_limit", "limite de hoje"))).toBe("domain");
    expect(classifyEvalError(new DomainError("agent_unavailable", "sem chave do modelo"))).toBe("domain");
  });

  it("DomainError dentro da cadeia de cause continua sendo regra do app", () => {
    expect(classifyEvalError(new Error("falhou o turno", { cause: messageLimit() }))).toBe("domain");
  });

  it("erro de banco (libSQL, Drizzle, SQLITE_*) é do banco, mesmo com texto parecido com rede", () => {
    const sqlite = Object.assign(new Error("database is locked"), { name: "LibsqlError", code: "SQLITE_BUSY" });
    expect(classifyEvalError(sqlite)).toBe("database");
    expect(classifyEvalError(new Error('Failed query: insert into "messages" ("id", "conversation_id")', { cause: sqlite }))).toBe("database");
    expect(classifyEvalError(new Error('Failed query: insert into "messages" ("id")'))).toBe("database");
    expect(classifyEvalError(Object.assign(new Error("disk I/O error"), { code: "SQLITE_FULL" }))).toBe("database");
  });

  it("erro de API do modelo: 503, 429 e 408 são do provedor; 401 e 400 não (é chave ou requisição)", () => {
    expect(classifyEvalError(apiError(503))).toBe("provider");
    expect(classifyEvalError(apiError(429))).toBe("provider");
    expect(classifyEvalError(apiError(408))).toBe("provider");
    expect(classifyEvalError(apiError(401))).toBe("unknown");
    expect(classifyEvalError(apiError(400))).toBe("unknown");
    expect(classifyEvalError(apiError(undefined))).toBe("provider"); // sem resposta HTTP: rede
  });

  it("segue a cadeia: RetryError do AI SDK (lastError) e MastraError (cause que não é Error)", () => {
    const retry = Object.assign(new Error("Failed after 3 attempts. Last error: high demand"), { name: "AI_RetryError", lastError: apiError(503) });
    expect(classifyEvalError(retry)).toBe("provider");
    const mastra = Object.assign(new Error("Erro no passo do agent"), { name: "MastraError", category: "THIRD_PARTY", cause: { message: "x" } });
    expect(classifyEvalError(mastra)).toBe("provider");
    const retry401 = Object.assign(new Error("Failed after 3 attempts"), { name: "AI_RetryError", lastError: apiError(401) });
    expect(classifyEvalError(retry401)).toBe("unknown");
  });

  it("rede e tempo esgotado são do provedor", () => {
    expect(classifyEvalError(new TypeError("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) }))).toBe("provider");
    expect(classifyEvalError(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }))).toBe("provider");
    expect(classifyEvalError(new DOMException("The operation was aborted due to timeout", "TimeoutError"))).toBe("provider");
    expect(classifyEvalError(new Error("The model is overloaded. Please try again later."))).toBe("provider");
    expect(classifyEvalError(Object.assign(new Error("falha"), { isRetryable: true }))).toBe("provider");
  });

  it("o turno sem uso do modelo (o Mastra engole o 503) é do provedor", () => {
    expect(classifyEvalError(new ProviderError("turno sem resposta do modelo (provedor)"))).toBe("provider");
  });

  it("erro do próprio harness ou desconhecido não é do provedor", () => {
    expect(classifyEvalError(new Error("Funcionário ana.souza@nexo.com.br não existe no seed"))).toBe("unknown");
    expect(classifyEvalError("texto solto")).toBe("unknown");
    expect(classifyEvalError(undefined)).toBe("unknown");
  });

  it("não entra em laço quando a causa aponta para o próprio erro", () => {
    const loop = new Error("volta");
    loop.cause = loop;
    expect(classifyEvalError(loop)).toBe("unknown");
  });
});

describe("assertModelResponded (turno sem uso do modelo conta como falha do provedor)", () => {
  const trace = (usage: { inputTokens?: number; outputTokens?: number } | null) => ({ model: "google/gemini-3.5-flash", usage });

  it("resposta do agent com modelo mas sem tokens → ProviderError", () => {
    expect(() => assertModelResponded({ role: "agent", trace: trace(null) })).toThrow(ProviderError);
    expect(() => assertModelResponded({ role: "agent", trace: trace({ inputTokens: 0, outputTokens: 0 }) })).toThrow(ProviderError);
  });

  it("com tokens, ação do sistema (sem modelo) ou sem resposta, passa", () => {
    expect(() => assertModelResponded({ role: "agent", trace: trace({ inputTokens: 120, outputTokens: 8 }) })).not.toThrow();
    expect(() => assertModelResponded({ role: "agent", trace: { model: null, usage: null } })).not.toThrow();
    expect(() => assertModelResponded({ role: "analyst", trace: null })).not.toThrow();
    expect(() => assertModelResponded(undefined)).not.toThrow();
  });
});

describe("retryOnProviderError", () => {
  const options = () => ({ label: "duplicidade", attempts: 3, waitMs: (n: number) => 5000 * n, log: vi.fn(), sleep: vi.fn(async () => {}) });

  it("sucesso na primeira: nenhum erro do provedor", async () => {
    const o = options();
    expect(await retryOnProviderError(async () => "ok", o)).toEqual({ value: "ok", providerErrors: 0 });
    expect(o.log).not.toHaveBeenCalled();
  });

  it("503 uma vez e depois passa: repete, espera e conta 1 erro do provedor com a mensagem inteira", async () => {
    const o = options();
    const play = vi.fn().mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce("ok");
    expect(await retryOnProviderError(play, o)).toEqual({ value: "ok", providerErrors: 1 });
    expect(play).toHaveBeenCalledTimes(2);
    expect(o.sleep).toHaveBeenCalledWith(5000);
    expect(o.log).toHaveBeenCalledWith(expect.stringContaining("erro do provedor na tentativa 1: AI_APICallError: Erro da API (503)"));
  });

  it("provedor fora em todas as tentativas: devolve null e não espera depois da última", async () => {
    const o = options();
    const play = vi.fn().mockRejectedValue(new ProviderError("turno sem resposta do modelo (provedor)"));
    expect(await retryOnProviderError(play, o)).toEqual({ value: null, providerErrors: 3 });
    expect(play).toHaveBeenCalledTimes(3);
    expect(o.sleep).toHaveBeenCalledTimes(2);
  });

  it("message_limit: 1 tentativa, nada contado como provedor, para com o motivo real", async () => {
    const o = options();
    const play = vi.fn().mockRejectedValue(messageLimit());
    const failure = await retryOnProviderError(play, o).catch((error) => error);
    expect(failure).toBeInstanceOf(EvalHarnessError);
    expect(failure.message).toContain("duplicidade");
    expect(failure.message).toContain("regra do app");
    expect(failure.message).toContain("Você enviou muitas mensagens em pouco tempo");
    expect(failure.cause).toBeInstanceOf(DomainError);
    expect(play).toHaveBeenCalledTimes(1);
    expect(o.sleep).not.toHaveBeenCalled();
    expect(o.log).not.toHaveBeenCalledWith(expect.stringContaining("erro do provedor"));
  });

  it("erro de banco para na hora e mostra a causa inteira", async () => {
    const o = options();
    const sqlite = Object.assign(new Error("database or disk is full"), { name: "LibsqlError", code: "SQLITE_FULL" });
    const play = vi.fn().mockRejectedValue(new Error('Failed query: insert into "messages" ("id", "conversation_id", "role", "author_name", "text")', { cause: sqlite }));
    const failure = await retryOnProviderError(play, o).catch((error) => error);
    expect(failure).toBeInstanceOf(EvalHarnessError);
    expect(failure.message).toContain("banco");
    expect(failure.message).toContain("causa: LibsqlError: database or disk is full [SQLITE_FULL]");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("erro desconhecido também para (não vira 'provedor' por exclusão)", async () => {
    const o = options();
    const failure = await retryOnProviderError(async () => {
      throw new Error("Funcionário x não existe no seed");
    }, o).catch((error) => error);
    expect(failure).toBeInstanceOf(EvalHarnessError);
    expect(failure.message).toContain("não existe no seed");
    expect(failure.message).toContain("não reconhecido");
  });
});
