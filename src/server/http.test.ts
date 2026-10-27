import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isCrossSiteMutation, parseBody } from "./http";

const post = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/chat", { method: "POST", headers: { host: "localhost:3000", ...headers }, body: "{}" });

describe("proteção CSRF", () => {
  it("bloqueia POST vindo de outro site", () => {
    expect(isCrossSiteMutation(post({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteMutation(post({ origin: "https://atacante.com" }))).toBe(true);
  });

  it("aceita POST do próprio site", () => {
    expect(isCrossSiteMutation(post({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteMutation(post({ origin: "http://localhost:3000" }))).toBe(false);
  });

  it("não se aplica a leituras (GET)", () => {
    const get = new Request("http://localhost:3000/api/chat", { headers: { "sec-fetch-site": "cross-site" } });
    expect(isCrossSiteMutation(get)).toBe(false);
  });
});

describe("parseBody", () => {
  it("recusa corpo que não é JSON (ex.: formulário text/plain)", async () => {
    const request = new Request("http://x/api", { method: "POST", headers: { "content-type": "text/plain" }, body: '{"text":"oi"}' });
    await expect(parseBody(request, z.object({ text: z.string() }))).rejects.toMatchObject({ status: 415 });
  });
});
