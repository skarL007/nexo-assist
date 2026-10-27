import { describe, expect, it } from "vitest";
import type { ConsoleConversationSummary } from "@/contracts/chat";
import { matchesFilter, matchesSearch, sortForConsole, statusLine } from "./conversation-filters";

const base: ConsoleConversationSummary = {
  id: "c1",
  employee: { id: "ana", name: "Ana Souza", department: "Financeiro" },
  status: "with_agent",
  analyst: null,
  handoffReason: null,
  handoffConfidence: null,
  handoffAt: null,
  lastMessage: { role: "employee", text: "Minha VPN caiu", at: "2026-10-27T13:00:00Z" },
  ticketCode: null,
};

describe("filtros do console", () => {
  it("'Para você' mostra só quem espera atendente", () => {
    expect(matchesFilter({ ...base, status: "waiting_analyst" }, "queue", "rafael")).toBe(true);
    expect(matchesFilter(base, "queue", "rafael")).toBe(false);
  });

  it("'Minhas' mostra só as que eu assumi", () => {
    const mine = { ...base, status: "with_analyst" as const, analyst: { id: "rafael", name: "Rafael Lima" } };
    expect(matchesFilter(mine, "mine", "rafael")).toBe(true);
    expect(matchesFilter(mine, "mine", "juliana")).toBe(false);
  });

  it("busca por nome, chamado ou texto", () => {
    expect(matchesSearch({ ...base, ticketCode: "INC-20311" }, "20311")).toBe(true);
    expect(matchesSearch(base, "vpn")).toBe(true);
    expect(matchesSearch(base, "impressora")).toBe(false);
  });
});

describe("estado na lista", () => {
  it("mostra a confiança quando o agent pediu ajuda", () => {
    const line = statusLine({ ...base, status: "waiting_analyst", handoffReason: "low_confidence", handoffConfidence: 0.41 }, "rafael");
    expect(line).toEqual({ tone: "warning", text: "Agent pediu ajuda · confiança 41%" });
  });

  it("quem espera há mais tempo aparece primeiro", () => {
    const older = { ...base, id: "old", status: "waiting_analyst" as const, handoffAt: "2026-10-27T12:00:00Z" };
    const newer = { ...base, id: "new", status: "waiting_analyst" as const, handoffAt: "2026-10-27T12:30:00Z" };
    expect(sortForConsole([base, newer, older]).map((c) => c.id)).toEqual(["old", "new", "c1"]);
  });
});
