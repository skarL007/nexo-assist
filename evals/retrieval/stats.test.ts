import { describe, expect, it } from "vitest";
import { fingerprint, mcnemar, wilson } from "./stats";

describe("intervalo de Wilson (95%)", () => {
  it("78 de 81 vai de ~89,7% a ~98,7%: com poucas perguntas, 96% não é um número exato", () => {
    const { low, high } = wilson(78, 81);
    expect(low).toBeCloseTo(0.8967, 3);
    expect(high).toBeCloseTo(0.9873, 3);
  });

  it("nos extremos não sai de [0, 1] e não colapsa num ponto", () => {
    expect(wilson(18, 18).high).toBe(1);
    expect(wilson(18, 18).low).toBeGreaterThan(0.8);
    expect(wilson(18, 18).low).toBeLessThan(0.9);
    expect(wilson(0, 10).low).toBe(0);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe("McNemar exato (pareado, bicaudal)", () => {
  const right = (n: number) => Array.from({ length: n }, () => true);
  const wrong = (n: number) => Array.from({ length: n }, () => false);

  it("só as discordâncias contam: 5 a 0 ainda não é significativo (p = 0,0625)", () => {
    const a = [...right(5), ...right(70)];
    const b = [...wrong(5), ...right(70)];
    expect(mcnemar(a, b)).toMatchObject({ aOnly: 5, bOnly: 0, p: 0.0625 });
  });

  it("6 a 0 é (p = 0,03125); empate dá p = 1", () => {
    expect(mcnemar(right(6), wrong(6)).p).toBeCloseTo(0.03125, 6);
    expect(mcnemar([true, false], [false, true]).p).toBe(1);
    expect(mcnemar(right(3), right(3))).toMatchObject({ aOnly: 0, bOnly: 0, p: 1 });
  });

  it("recusa listas de tamanhos diferentes (não seria pareado)", () => {
    expect(() => mcnemar([true], [true, false])).toThrow();
  });
});

describe("impressão digital de um conjunto", () => {
  it("muda com qualquer alteração e não depende da ordem das chaves do objeto", () => {
    const set = [{ query: "VPN 809", expected: "kb-vpn-809" }];
    expect(fingerprint(set)).toBe(fingerprint([{ expected: "kb-vpn-809", query: "VPN 809" }]));
    expect(fingerprint(set)).not.toBe(fingerprint([{ query: "VPN 809 ", expected: "kb-vpn-809" }]));
    expect(fingerprint(set)).toMatch(/^[0-9a-f]{12}$/);
  });
});
