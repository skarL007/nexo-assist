import { describe, expect, it } from "vitest";
import { classifyPriority, slaDeadline, ticketSla } from "./priority";

const brt = (isoLocal: string) => new Date(`${isoLocal}-03:00`);

describe("classifyPriority", () => {
  it("algo parado para uma equipe é crítico", () => {
    expect(classifyPriority("team", "blocked").priority).toBe("critical");
  });

  it("compromisso no mesmo dia para uma pessoa é alta", () => {
    const decision = classifyPriority("me", "deadline_today");
    expect(decision.priority).toBe("high");
    expect(decision.reason).toContain("compromisso hoje");
  });

  it("atrapalha mas há alternativa é média", () => {
    expect(classifyPriority("me", "has_workaround").priority).toBe("medium");
  });

  it("pedido sem urgência é baixa", () => {
    expect(classifyPriority("me", "none").priority).toBe("low");
  });
});

describe("slaDeadline", () => {
  it("crítico conta 1 hora corrida, mesmo fora do expediente", () => {
    expect(slaDeadline("critical", brt("2026-10-24T22:00:00"))).toEqual(brt("2026-10-24T23:00:00"));
  });

  it("alta conta 4 horas úteis", () => {
    expect(slaDeadline("high", brt("2026-10-21T09:43:00"))).toEqual(brt("2026-10-21T13:43:00"));
  });
});

describe("ticketSla", () => {
  const updatedAt = brt("2026-10-15T10:00:00");

  it("marca como vencido quando passou do prazo", () => {
    const sla = ticketSla({ priority: "medium", status: "waiting_analyst", updatedAt }, brt("2026-10-21T10:00:00"));
    expect(sla?.overdue).toBe(true);
  });

  it("dentro do prazo não está vencido", () => {
    const sla = ticketSla({ priority: "medium", status: "open", updatedAt }, brt("2026-10-16T10:00:00"));
    expect(sla?.overdue).toBe(false);
  });

  it("chamado resolvido não tem prazo", () => {
    expect(ticketSla({ priority: "medium", status: "resolved", updatedAt }, new Date())).toBeNull();
  });
});
