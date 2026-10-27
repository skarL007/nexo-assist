import { describe, expect, it } from "vitest";
import { parseOpenRouterBody } from "./cost-meter";

describe("leitura das respostas do OpenRouter", () => {
  it("stream SSE: junta tools pedidas e pega custo e tokens do último evento", () => {
    const body = [
      ": OPENROUTER PROCESSING",
      'data: {"id":"gen-1","provider":"Google","choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"recordUnderstanding","arguments":""}}]}}]}',
      'data: {"id":"gen-1","choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"intent\\":"}}]}}]}',
      'data: {"id":"gen-1","choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":3100,"completion_tokens":45,"cost":0.0051,"completion_tokens_details":{"reasoning_tokens":12}}}',
      "data: [DONE]",
    ].join("\n");

    expect(parseOpenRouterBody(body)).toEqual({
      provider: "Google",
      costUsd: 0.0051,
      inputTokens: 3100,
      outputTokens: 45,
      reasoningTokens: 12,
      toolCalls: ["recordUnderstanding"],
      finishReason: "tool_calls",
      error: null,
    });
  });

  it("erro no meio do stream é registrado", () => {
    const body = 'data: {"error":{"message":"Provider returned error"}}\n\ndata: [DONE]';
    expect(parseOpenRouterBody(body).error).toBe("Provider returned error");
  });

  it("resposta JSON única (sem stream) também é lida", () => {
    const body = JSON.stringify({
      provider: "OpenAI",
      choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: { name: "getTicket" } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.00001 },
    });
    const parsed = parseOpenRouterBody(body);
    expect(parsed.toolCalls).toEqual(["getTicket"]);
    expect(parsed.costUsd).toBe(0.00001);
    expect(parsed.provider).toBe("OpenAI");
  });

  it("corpo ilegível não derruba a medição", () => {
    expect(parseOpenRouterBody("<html>502</html>").costUsd).toBe(0);
  });
});
