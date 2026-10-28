import { describe, expect, it } from "vitest";
import { formatSeconds, formatUsd } from "./format";

describe("formatação dos indicadores", () => {
  it("segundos com uma casa, em português", () => {
    expect(formatSeconds(3240)).toBe("3,2 s");
    expect(formatSeconds(12_000)).toBe("12 s");
  });

  it("custo: centavos com 2 algarismos significativos; acima de 1 dólar, 2 casas", () => {
    expect(formatUsd(0.015_63)).toBe("US$ 0,016");
    expect(formatUsd(10.6)).toBe("US$ 10,60");
  });
});
