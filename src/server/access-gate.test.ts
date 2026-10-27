import { describe, expect, it } from "vitest";
import { createAccessToken, decideAccess, sameSecret } from "./access-gate";

const SECRET = "s3gredo-do-servidor-que-assina-os-links";
const NOW = new Date("2026-10-27T19:00:00Z");
const in5min = new Date(NOW.getTime() + 5 * 60_000);
const valid = createAccessToken(SECRET, in5min);
const expired = createAccessToken(SECRET, new Date(NOW.getTime() - 1000));

const decide = (tokenFromUrl: string | null, tokenFromCookie?: string) =>
  decideAccess({ secret: SECRET, tokenFromUrl, tokenFromCookie, now: NOW });

describe("porta de acesso com link temporário", () => {
  it("fica aberta quando não há segredo configurado (dev local)", () => {
    expect(decideAccess({ secret: undefined, tokenFromUrl: null, tokenFromCookie: undefined, now: NOW })).toEqual({ kind: "open" });
  });

  it("libera o link assinado dentro da validade e diz até quando vale", () => {
    expect(decide(valid)).toEqual({ kind: "grant", expiresAt: in5min });
  });

  it("nega o link vencido", () => {
    expect(decide(expired)).toEqual({ kind: "deny" });
  });

  it("nega link adulterado: validade trocada ou assinatura de outro segredo", () => {
    const [, signature] = valid.split(".");
    const longer = `${Math.floor(in5min.getTime() / 1000) + 86_400}.${signature}`;
    expect(decide(longer)).toEqual({ kind: "deny" });
    expect(decide(createAccessToken("outro-segredo", in5min))).toEqual({ kind: "deny" });
    expect(decide("sem-formato")).toEqual({ kind: "deny" });
  });

  it("não aceita o próprio segredo no link (ele nunca sai do servidor)", () => {
    expect(decide(SECRET)).toEqual({ kind: "deny" });
  });

  it("libera quem tem o cookie dentro da validade e corta quando ela acaba", () => {
    expect(decide(null, valid)).toEqual({ kind: "allow" });
    expect(decide(null, expired)).toEqual({ kind: "deny" });
  });

  it("nega token errado no link, mesmo com cookie válido", () => {
    expect(decide("chute", valid)).toEqual({ kind: "deny" });
  });

  it("nega quem chega sem nada", () => {
    expect(decide(null)).toEqual({ kind: "deny" });
  });

  it("compara segredos de tamanhos diferentes sem lançar erro", () => {
    expect(sameSecret("a", "abc")).toBe(false);
  });
});
