import { describe, expect, it } from "vitest";
import { slaRisk } from "@/domain/sla-risk";
import { explainSla, formatBusinessDuration } from "./sla-text";

const brt = (isoLocal: string) => new Date(`${isoLocal}-03:00`);
const HOUR = 3_600_000;

describe("duração em tempo útil", () => {
  it("minutos, horas e dias úteis (dia útil = 10 h de expediente)", () => {
    expect(formatBusinessDuration(0.75 * HOUR)).toBe("45 min úteis");
    expect(formatBusinessDuration(4.5 * HOUR)).toBe("4,5 h úteis");
    expect(formatBusinessDuration(25 * HOUR)).toBe("2,5 dias úteis");
    expect(formatBusinessDuration(10 * HOUR)).toBe("1 dia útil");
  });
});

describe("explicação do prazo (o porquê)", () => {
  it("em risco: janela, de quando conta, prazo, quanto passou e quanto falta", () => {
    const risk = slaRisk({ code: "INC-1", title: "Notebook lento", priority: "high", status: "open", updatedAt: brt("2026-10-21T10:00:00") }, brt("2026-10-21T13:15:00"))!;
    const text = explainSla(risk);
    expect(text.headline).toBe("INC-1 vence em 45 min úteis");
    expect(text.lines).toEqual([
      "Prioridade Alta: resposta em até 4 horas úteis, a contar da última atualização (21 de out, 10:00).",
      "Prazo: 21 de out, 14:00 (expediente de seg. a sex., 8h às 18h).",
      "Já passou 81% do prazo; faltam 45 min úteis.",
    ]);
  });

  it("vencido, com o relógio parado no fim de semana", () => {
    const risk = slaRisk({ code: "INC-2", title: "VPN", priority: "high", status: "open", updatedAt: brt("2026-10-23T16:00:00") }, brt("2026-10-26T12:00:00"))!;
    const text = explainSla(risk);
    expect(text.headline).toBe("INC-2 venceu o prazo há 2 h úteis");
    // Sexta 16h → segunda 10h (prazo): 66 h corridas, 4 h úteis.
    expect(text.lines).toContain("O relógio ficou parado 62 h fora do expediente (noites e fim de semana).");
  });
});
