import { describe, expect, it } from "vitest";
import type { Conversation } from "@/domain/conversation";
import { DomainError } from "@/domain/errors";
import type { Services } from "@/infrastructure/container";
import { consoleDetail, slaAlerts } from "./views";

const conversation: Conversation = {
  id: "conv-carla",
  employeeId: "emp-carla",
  status: "waiting_analyst",
  analystId: null,
  handoff: null,
  createdAt: new Date("2026-10-27T13:00:00Z"),
  updatedAt: new Date("2026-10-27T13:00:00Z"),
};

const services = {
  employees: { listByIds: async () => [{ id: "emp-carla", name: "Carla Mendes", email: "carla.mendes@nexo.com.br", role: "employee", department: "Comercial" }] },
  messages: { listByConversation: async () => [] },
  drafts: { statuses: async () => ({ 7: "pending" }) },
  feedback: { byConversation: async () => ({ m1: false }) },
  tickets: {
    listMine: async () => {
      throw new DomainError("legacy_unavailable", "O sistema de chamados está indisponível no momento.");
    },
    snapshot: () => {
      throw new Error("não deveria montar chamados");
    },
  },
} as unknown as Services;

describe("detalhe da conversa no console", () => {
  it("se o sistema de chamados cair, a conversa abre mesmo assim (os chamados ficam indisponíveis)", async () => {
    // Achado da auditoria: 1 em cada ~40 aberturas ficava em "Carregando conversa…" para sempre.
    const detail = await consoleDetail(services, conversation);
    expect(detail.id).toBe("conv-carla");
    expect(detail.tickets).toBeNull();
  });

  it("traz o status atual dos rascunhos, para o relatório saber o que ainda espera confirmação", async () => {
    const detail = await consoleDetail(services, conversation);
    expect(detail.draftStatuses).toEqual({ 7: "pending" });
    expect(detail.feedback).toEqual({ m1: false });
  });
});

describe("alertas de prazo para a tela", () => {
  const snap = (code: string, hoursAgo: number, priority: "high" | "medium") => ({
    code,
    type: "INC" as const,
    title: code,
    description: "",
    category: "hardware" as const,
    priority,
    status: "open" as const,
    impact: "me" as const,
    createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    deadline: null,
    overdue: false,
  });

  it("só os vencidos ou em risco, o mais atrasado primeiro, cada um com o porquê", () => {
    const alerts = slaAlerts([snap("INC-NOVO", 0, "medium"), snap("INC-POUCO", 24 * 10, "medium"), snap("INC-MUITO", 24 * 30, "medium")], new Date());
    expect(alerts.map((a) => a.code)).toEqual(["INC-MUITO", "INC-POUCO"]);
    expect(alerts[0]).toMatchObject({ level: "overdue", headline: expect.stringContaining("venceu o prazo há") });
    expect(alerts[0].lines[0]).toContain("Prioridade Média");
  });
});
