import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain/employee";
import { formatHour, turnBriefing } from "./turn-briefing";

const elisa: Employee = {
  id: "emp-elisa",
  name: "Elisa Prado",
  email: "elisa.prado@nexo.com.br",
  role: "employee",
  department: "RH",
  passwordChangedAt: new Date(0),
};

describe("briefing do turno", () => {
  it("mostra a hora cheia em Brasília", () => {
    expect(formatHour(new Date("2026-10-27T19:44:00Z"))).toBe("ter., 27/10, 16h");
  });

  it("não muda dentro da mesma hora: o prefixo do prompt continua cacheável", () => {
    const a = turnBriefing(elisa, new Date("2026-10-27T19:01:00Z"), []);
    const b = turnBriefing(elisa, new Date("2026-10-27T19:59:00Z"), []);
    expect(a).toBe(b);
    expect(a).toContain("Rascunhos aguardando confirmação: nenhum.");
  });

  it("lista os rascunhos pendentes", () => {
    const text = turnBriefing(elisa, new Date("2026-10-27T19:00:00Z"), [
      {
        id: 7,
        kind: "update",
        status: "pending",
        fields: { ticketCode: "INC-20311", ticketTitle: "Notebook lento", comment: "trava no Excel", reopen: false },
      },
    ]);
    expect(text).toContain("D-7 (atualização do INC-20311)");
  });
});
