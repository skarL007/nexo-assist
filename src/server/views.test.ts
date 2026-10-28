import { describe, expect, it } from "vitest";
import type { Conversation } from "@/domain/conversation";
import { DomainError } from "@/domain/errors";
import type { Services } from "@/infrastructure/container";
import { consoleDetail } from "./views";

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
});
