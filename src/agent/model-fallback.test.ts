import { describe, expect, it } from "vitest";
import { fallbackNote, modelChain, readStepFinish } from "./model-fallback";

const anyKey = () => true;

describe("cadeia de modelos", () => {
  it("principal com 1 nova tentativa, depois o reserva com 2", () => {
    expect(modelChain("google/gemini-3.5-flash", "google/gemini-3.5-flash-lite", anyKey)).toEqual([
      { model: "google/gemini-3.5-flash", maxRetries: 1 },
      { model: "google/gemini-3.5-flash-lite", maxRetries: 2 },
    ]);
  });

  it("sem reserva quando é 'off', igual ao principal ou sem a chave do provedor", () => {
    const only = [{ model: "google/gemini-3.5-flash", maxRetries: 2 }];
    expect(modelChain("google/gemini-3.5-flash", "off", anyKey)).toEqual(only);
    expect(modelChain("google/gemini-3.5-flash", "google/gemini-3.5-flash", anyKey)).toEqual(only);
    expect(modelChain("google/gemini-3.5-flash", "openrouter/x/y", (m) => m.startsWith("google/"))).toEqual(only);
  });
});

describe("leitura do fim de cada passo", () => {
  it("passo bom traz o uso; tentativa que falhou não conta tokens", () => {
    expect(readStepFinish({ stepResult: { reason: "tool-calls" }, output: { usage: { inputTokens: 62, outputTokens: 15 } } })).toEqual({
      usage: { inputTokens: 62, outputTokens: 15 },
      fallbackIndex: null,
      retried: false,
    });
    expect(readStepFinish({ stepResult: { reason: "retry" }, output: { usage: {} } })).toEqual({ usage: null, fallbackIndex: null, retried: true });
  });

  it("passo feito pelo reserva traz o índice do modelo", () => {
    expect(readStepFinish({ fallbackModelIndex: 1, output: { usage: { inputTokens: 10, outputTokens: 2 } } }).fallbackIndex).toBe(1);
    expect(readStepFinish(undefined)).toEqual({ usage: null, fallbackIndex: null, retried: false });
  });
});

describe("nota no trace", () => {
  it("diz qual modelo falhou e qual respondeu", () => {
    expect(fallbackNote("google/gemini-3.5-flash", "google/gemini-3.5-flash-lite")).toBe(
      "O modelo principal (google/gemini-3.5-flash) não respondeu; o turno seguiu no modelo reserva (google/gemini-3.5-flash-lite).",
    );
  });
});
