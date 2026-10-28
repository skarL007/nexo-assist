import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api-client";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("sem conexão, a mensagem é em português (não \"Failed to fetch\")", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(apiFetch("/api/chat")).rejects.toThrow("Sem conexão com o servidor. Verifique a rede e tente de novo.");
  });
});

describe("messageOf", () => {
  it("lê a mensagem de Error e do erro serializado do Redux", async () => {
    const { messageOf } = await import("./api-client");
    expect(messageOf(new Error("a"), "x")).toBe("a");
    expect(messageOf({ name: "Error", message: "b" }, "x")).toBe("b");
    expect(messageOf(undefined, "x")).toBe("x");
  });
});
