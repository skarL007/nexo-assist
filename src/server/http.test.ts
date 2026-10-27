import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { isCrossSiteMutation, logError, parseBody } from "./http";

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

  it("Origin inválido (ex.: \"null\") conta como outro site, sem erro 500", () => {
    expect(isCrossSiteMutation(post({ origin: "null" }))).toBe(true);
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

  it("compara o tipo exato: 'text/plain; x=application/json' não passa por JSON", async () => {
    const request = new Request("http://x/api", { method: "POST", headers: { "content-type": "text/plain; x=application/json" }, body: "{}" });
    await expect(parseBody(request, z.object({}))).rejects.toMatchObject({ status: 415 });
  });

  it("aceita application/json com charset", async () => {
    const request = new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: '{"text":"oi"}' });
    await expect(parseBody(request, z.object({ text: z.string() }))).resolves.toEqual({ text: "oi" });
  });
});

describe("logError", () => {
  it("não grava os parâmetros da consulta (texto do chat, e-mail) quando o banco falha", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
    const error = Object.assign(new Error("Failed query: insert into messages ...\nparams: oi, ana.souza@nexo.com.br"), {
      name: "DrizzleQueryError",
      query: "insert into messages ...",
      params: ["oi", "ana.souza@nexo.com.br"],
      cause,
    });
    logError(error);
    const logged = spy.mock.calls.flat().join(" ");
    spy.mockRestore();
    expect(logged).toContain("SQLITE_BUSY");
    expect(logged).not.toContain("ana.souza@nexo.com.br");
  });
});
