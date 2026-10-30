import { describe, expect, it } from "vitest";
import { cooldownMs, EmbeddingHttpError, ProviderBreaker } from "./provider-breaker";

describe("disjuntor dos provedores de embeddings", () => {
  it("sem crédito ou sem permissão espera 15 min; o resto, 1 min", () => {
    for (const status of [401, 402, 403]) expect(cooldownMs(new EmbeddingHttpError(status))).toBe(15 * 60_000);
    for (const status of [429, 500, 503]) expect(cooldownMs(new EmbeddingHttpError(status))).toBe(60_000);
    expect(cooldownMs(new DOMException("timeout", "TimeoutError"))).toBe(60_000);
    expect(cooldownMs(new TypeError("fetch failed"))).toBe(60_000);
  });

  it("abre por provedor e fecha sozinho quando o tempo passa", () => {
    let now = 0;
    const breaker = new ProviderBreaker(() => now);
    breaker.trip("a", new EmbeddingHttpError(503));
    expect(breaker.isOpen("a")).toBe(true);
    expect(breaker.isOpen("b")).toBe(false);
    now = 59_999;
    expect(breaker.isOpen("a")).toBe(true);
    now = 60_000;
    expect(breaker.isOpen("a")).toBe(false);
  });
});
