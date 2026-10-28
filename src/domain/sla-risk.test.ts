import { describe, expect, it } from "vitest";
import { slaRisk } from "./sla-risk";
import type { Ticket } from "./ticket";

const brt = (isoLocal: string) => new Date(`${isoLocal}-03:00`);
const ticket = (overrides: Partial<Ticket>): Pick<Ticket, "code" | "title" | "priority" | "status" | "updatedAt"> => ({
  code: "INC-1",
  title: "Notebook lento",
  priority: "high",
  status: "open",
  updatedAt: brt("2026-10-21T10:00:00"),
  ...overrides,
});
const HOUR = 3_600_000;

describe("prazo em risco, com o porquê", () => {
  it("ainda folgado (menos de 75% do prazo usado): sem alerta", () => {
    // Alta = 4 h úteis; às 12h passaram 2 h (50%).
    expect(slaRisk(ticket({}), brt("2026-10-21T12:00:00"))).toBeNull();
  });

  it("75% ou mais do prazo usado: em risco, com quanto falta em tempo útil", () => {
    const risk = slaRisk(ticket({}), brt("2026-10-21T13:15:00"));
    expect(risk).toMatchObject({ level: "at_risk", code: "INC-1", priority: "high", remainingMs: 0.75 * HOUR, usedFraction: 0.8125 });
    expect(risk?.deadline).toEqual(brt("2026-10-21T14:00:00"));
  });

  it("passou do prazo: vencido, com o atraso em tempo útil", () => {
    const risk = slaRisk(ticket({}), brt("2026-10-22T09:00:00"));
    // Venceu 14h do dia 21; até 18h são 4 h úteis, e mais 1 h no dia 22.
    expect(risk).toMatchObject({ level: "overdue", overdueMs: 5 * HOUR });
  });

  it("explica quando o relógio parou fora do expediente (noite e fim de semana)", () => {
    // Sexta 16h + 4 h úteis = segunda 10h: 66 h corridas, 4 h úteis.
    const risk = slaRisk(ticket({ updatedAt: brt("2026-10-23T16:00:00") }), brt("2026-10-26T09:30:00"));
    // Até segunda 9h30: 65,5 h corridas, das quais só 3,5 h úteis (sexta 16h–18h e segunda 8h–9h30).
    expect(risk).toMatchObject({ level: "at_risk", remainingMs: 0.5 * HOUR, pausedMs: 62 * HOUR });
  });

  it("crítico conta horas corridas (plantão 24 h): nada de relógio parado", () => {
    const risk = slaRisk(ticket({ priority: "critical", updatedAt: brt("2026-10-24T22:00:00") }), brt("2026-10-24T22:50:00"));
    expect(risk).toMatchObject({ level: "at_risk", remainingMs: (1 / 6) * HOUR, pausedMs: 0 });
  });

  it("resolvido não tem prazo", () => {
    expect(slaRisk(ticket({ status: "resolved" }), brt("2026-10-30T10:00:00"))).toBeNull();
  });
});
