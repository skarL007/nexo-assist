import { describe, expect, it } from "vitest";
import type { ConversationReport } from "@/domain/conversation-report";
import { reportAsText } from "@/lib/report-text";

const report: ConversationReport = {
  employee: { name: "Carla Mendes", department: "Comercial" },
  status: "waiting_analyst",
  startedAt: "2026-10-27T13:00:00.000Z",
  lastAt: "2026-10-27T13:07:00.000Z",
  counts: { employee: 2, agent: 1, analyst: 0 },
  need: "Carla precisa de perfil de aprovação no SAP.",
  handoff: { reason: "low_confidence", summary: "…", confidence: 0.41, at: "2026-10-27T13:07:00.000Z" },
  actions: ["consultou seus chamados"],
  failures: [],
  articles: [],
  tickets: [
    {
      code: "INC-20320",
      ticket: {
        code: "INC-20320",
        type: "INC",
        title: "Acesso ao SAP",
        description: "",
        category: "access",
        priority: "high",
        status: "waiting_analyst",
        impact: "me",
        createdAt: "2026-10-27T10:00:00.000Z",
        updatedAt: "2026-10-27T10:00:00.000Z",
        deadline: "2026-10-27T14:00:00.000Z",
        overdue: false,
      },
    },
    { code: "REQ-1", ticket: null },
  ],
  lowestConfidence: 0.41,
  pending: [{ kind: "waiting_analyst", since: "2026-10-27T13:07:00.000Z" }],
};

describe("relatório em texto (botão Copiar)", () => {
  it("traz as seções na ordem de leitura do analista, com horário de Brasília", () => {
    const text = reportAsText(report);
    expect(text).toContain("Relatório da conversa · Carla Mendes (Comercial)");
    expect(text).toContain("Precisa: Carla precisa de perfil de aprovação no SAP.");
    expect(text).toContain("Transferida em 27 de out, 10:07 · Agent sem segurança para decidir · confiança 41%");
    expect(text).toContain("- INC-20320 · Acesso ao SAP · Aguardando analista · prioridade Alta · prazo 27 de out, 11:00");
    expect(text).toContain("- REQ-1 (sem dados do sistema de chamados agora)");
    expect(text).toContain("- Carla espera um atendente desde 27 de out, 10:07");
    expect(text.indexOf("Precisa:")).toBeLessThan(text.indexOf("O agent já fez"));
    expect(text).not.toMatch(/undefined|null/);
  });

  it("seções vazias não aparecem", () => {
    const text = reportAsText({ ...report, articles: [], failures: [], pending: [] });
    expect(text).not.toContain("Artigos");
    expect(text).not.toContain("Falhas");
    expect(text).not.toContain("Pendências");
  });
});
