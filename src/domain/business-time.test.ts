import { describe, expect, it } from "vitest";
import { addBusinessDays, addBusinessHours } from "./business-time";

// Horários em UTC: 13:00Z = 10:00 em Brasília.
const brt = (isoLocal: string) => new Date(`${isoLocal}-03:00`);

describe("addBusinessHours", () => {
  it("soma dentro do mesmo dia", () => {
    expect(addBusinessHours(brt("2026-10-21T10:00:00"), 4)).toEqual(brt("2026-10-21T14:00:00"));
  });

  it("passa para o dia seguinte quando o expediente acaba", () => {
    expect(addBusinessHours(brt("2026-10-21T16:00:00"), 4)).toEqual(brt("2026-10-22T10:00:00"));
  });

  it("pula o fim de semana: sexta 17h + 4h = segunda 11h", () => {
    expect(addBusinessHours(brt("2026-10-23T17:00:00"), 4)).toEqual(brt("2026-10-26T11:00:00"));
  });

  it("começa a contar na abertura quando o pedido chega de madrugada", () => {
    expect(addBusinessHours(brt("2026-10-21T03:00:00"), 1)).toEqual(brt("2026-10-21T09:00:00"));
  });

  it("começa a contar na segunda quando o pedido chega no sábado", () => {
    expect(addBusinessHours(brt("2026-10-24T11:00:00"), 2)).toEqual(brt("2026-10-26T10:00:00"));
  });
});

describe("addBusinessDays", () => {
  it("quarta 10h + 3 dias úteis = segunda 10h", () => {
    expect(addBusinessDays(brt("2026-10-21T10:00:00"), 3)).toEqual(brt("2026-10-26T10:00:00"));
  });
});
