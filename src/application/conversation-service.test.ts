import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain/employee";
import { ConversationService } from "./conversation-service";
import { fixedClock, InMemoryConversationRepository, InMemoryMessageRepository } from "./test-doubles";

const rafael: Employee = {
  id: "rafael",
  name: "Rafael Lima",
  email: "rafael.lima@nexo.com.br",
  role: "analyst",
  department: "Suporte N2",
  passwordChangedAt: new Date(),
};

function setup() {
  const messages = new InMemoryMessageRepository();
  return { messages, service: new ConversationService(new InMemoryConversationRepository(), messages, fixedClock("2026-10-27T13:00:00Z")) };
}

describe("transferência para analista", () => {
  it("leva o resumo e deixa uma mensagem de sistema no histórico", async () => {
    const { service, messages } = setup();
    const { id } = await service.getOrStart("ana");
    const updated = await service.handoff(id, { reason: "employee_request", summary: "Ana quer falar com alguém", ticketCode: null, confidence: null });

    expect(updated.status).toBe("waiting_analyst");
    expect(updated.handoff?.summary).toBe("Ana quer falar com alguém");
    expect(messages.items.at(-1)?.role).toBe("system");
  });

  it("analista assume, responde e devolve ao agent", async () => {
    const { service } = setup();
    const { id } = await service.getOrStart("ana");
    await service.handoff(id, { reason: "overdue", summary: "INC vencido", ticketCode: "INC-1", confidence: null });

    await service.assume(id, rafael);
    await service.postAnalystMessage(id, rafael, "Oi, Ana!");
    const released = await service.release(id, rafael);

    expect(released.status).toBe("with_agent");
    expect(released.analystId).toBeNull();
  });

  it("analista só responde depois de assumir", async () => {
    const { service } = setup();
    const { id } = await service.getOrStart("ana");
    await expect(service.postAnalystMessage(id, rafael, "Oi")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("funcionário não acessa a conversa de outra pessoa", async () => {
    const { service } = setup();
    const { id } = await service.getOrStart("ana");
    await expect(service.getForEmployee("carla", id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("limite da sessão", () => {
  it("conta as mensagens do funcionário", async () => {
    const { service, messages } = setup();
    const { id } = await service.getOrStart("ana");
    await messages.add({ conversationId: id, role: "employee", text: "oi" });
    await messages.add({ conversationId: id, role: "agent", text: "olá" });
    expect(await service.remainingMessages(id)).toBe(29);
  });
});
