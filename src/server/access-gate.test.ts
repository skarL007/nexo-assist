import { describe, expect, it } from "vitest";
import { decideAccess, sameSecret } from "./access-gate";

const TOKEN = "s3gredo-do-link-de-acesso";

describe("porta de acesso por token", () => {
  it("fica aberta quando não há token configurado (dev local)", () => {
    expect(decideAccess({ expectedToken: undefined, tokenFromUrl: null, tokenFromCookie: undefined })).toEqual({ kind: "open" });
  });

  it("libera e grava o cookie quando o link traz o token certo", () => {
    expect(decideAccess({ expectedToken: TOKEN, tokenFromUrl: TOKEN, tokenFromCookie: undefined })).toEqual({ kind: "grant" });
  });

  it("nega token errado no link, mesmo com cookie válido", () => {
    expect(decideAccess({ expectedToken: TOKEN, tokenFromUrl: "chute", tokenFromCookie: TOKEN })).toEqual({ kind: "deny" });
  });

  it("libera quem já tem o cookie", () => {
    expect(decideAccess({ expectedToken: TOKEN, tokenFromUrl: null, tokenFromCookie: TOKEN })).toEqual({ kind: "allow" });
  });

  it("nega quem chega sem nada", () => {
    expect(decideAccess({ expectedToken: TOKEN, tokenFromUrl: null, tokenFromCookie: undefined })).toEqual({ kind: "deny" });
  });

  it("compara segredos de tamanhos diferentes sem lançar erro", () => {
    expect(sameSecret("a", "abc")).toBe(false);
  });
});
