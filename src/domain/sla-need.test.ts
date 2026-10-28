import { describe, expect, it } from "vitest";
import { deadlineMeetsNeed, parseNeededBy } from "./sla-need";

// Quarta, 28/10/2026, 17h em Brasília.
const now = new Date("2026-10-28T20:00:00Z");

describe("até quando o funcionário precisa (neededBy)", () => {
  it("lê HH:MM de hoje, DD/MM (fim do expediente) e DD/MM HH:MM, no horário de Brasília", () => {
    expect(parseNeededBy("15:00", now)?.toISOString()).toBe("2026-10-28T18:00:00.000Z");
    expect(parseNeededBy("06/11", now)?.toISOString()).toBe("2026-11-06T21:00:00.000Z");
    expect(parseNeededBy("29/10 09:30", now)?.toISOString()).toBe("2026-10-29T12:30:00.000Z");
  });

  it("data já muito para trás vira o ano que vem (pedido em dezembro para 05/01)", () => {
    const december = new Date("2026-12-20T15:00:00Z");
    expect(parseNeededBy("05/01", december)?.toISOString()).toBe("2027-01-05T21:00:00.000Z");
  });

  it("formato inválido ou data impossível → null", () => {
    expect(parseNeededBy("amanhã", now)).toBeNull();
    expect(parseNeededBy("25:00", now)).toBeNull();
    expect(parseNeededBy("31/02", now)).toBeNull();
    expect(parseNeededBy("", now)).toBeNull();
  });
});

describe("o prazo do chamado atende a necessidade?", () => {
  const deadline = new Date("2026-10-29T14:00:00Z"); // quinta 11h

  it("reunião hoje às 15h e prazo amanhã 11h → não atende (oferece analista)", () => {
    expect(deadlineMeetsNeed(deadline, parseNeededBy("15:00", now))).toBe(false);
  });

  it("precisa até 06/11 e o prazo é amanhã → atende (não oferece)", () => {
    expect(deadlineMeetsNeed(deadline, parseNeededBy("06/11", now))).toBe(true);
  });

  it("prazo exatamente na hora da necessidade atende; sem necessidade informada também", () => {
    expect(deadlineMeetsNeed(deadline, deadline)).toBe(true);
    expect(deadlineMeetsNeed(deadline, null)).toBe(true);
  });
});
