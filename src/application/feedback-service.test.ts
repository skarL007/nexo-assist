import { describe, expect, it } from "vitest";
import { FeedbackService } from "./feedback-service";
import { fixedClock, InMemoryConversationRepository, InMemoryFeedbackRepository, InMemoryMessageRepository } from "./test-doubles";

async function setup() {
  const conversations = new InMemoryConversationRepository();
  const messages = new InMemoryMessageRepository();
  const feedback = new InMemoryFeedbackRepository();
  const at = new Date("2026-10-27T13:00:00Z");
  await conversations.insert({ id: "c-ana", employeeId: "ana", status: "with_agent", analystId: null, handoff: null, createdAt: at, updatedAt: at });
  const agent = await messages.add({ conversationId: "c-ana", role: "agent", text: "Reinicie o roteador." });
  const employee = await messages.add({ conversationId: "c-ana", role: "employee", text: "Ok" });
  return { feedback, agent, employee, service: new FeedbackService(feedback, messages, conversations, fixedClock("2026-10-27T13:05:00Z")) };
}

describe('"Isso resolveu?" nas respostas do agent', () => {
  it("grava a avaliação da pessoa dona da conversa; avaliar de novo troca a anterior", async () => {
    const { service, feedback, agent } = await setup();
    await service.rate("ana", agent.id, true);
    await service.rate("ana", agent.id, false);
    expect(await feedback.byConversation("c-ana")).toEqual({ [agent.id]: false });
  });

  it("outra pessoa não avalia (nem descobre) mensagem que não é dela", async () => {
    const { service, agent } = await setup();
    await expect(service.rate("bruno", agent.id, true)).rejects.toMatchObject({ code: "not_found" });
  });

  it("só respostas do agent recebem avaliação", async () => {
    const { service, employee } = await setup();
    await expect(service.rate("ana", employee.id, true)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.rate("ana", "nao-existe", true)).rejects.toMatchObject({ code: "not_found" });
  });
});
