import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain/employee";
import { ConversationService } from "./conversation-service";
import type { BudgetRepository, ReplyWriter, SuggestionRepository } from "./ports";
import { ReplySuggestionService } from "./reply-suggestion-service";
import { fixedClock, InMemoryConversationRepository, InMemoryMessageRepository } from "./test-doubles";

const analyst = (id: string, name: string): Employee => ({ id, name, email: `${id}@nexo.com.br`, role: "analyst", department: "Suporte", passwordChangedAt: new Date() });
const rafael = analyst("rafael", "Rafael Lima");
const juliana = analyst("juliana", "Juliana Costa");

class FakeWriter implements ReplyWriter {
  calls = 0;
  constructor(private readonly text: string) {}
  async write() {
    this.calls++;
    return { text: this.text, usage: { inputTokens: 900, outputTokens: 60 } };
  }
}
class FakeBudget implements BudgetRepository {
  constructor(private left: number) {}
  async reserve() {
    return this.left-- > 0;
  }
}
class FakeSuggestions implements SuggestionRepository {
  events: string[] = [];
  async record(e: { outcome: string }) {
    this.events.push(e.outcome);
  }
  async countsSince() {
    return { generated: 0, sent_as_is: 0, sent_edited: 0 };
  }
}

async function setup(text = "Oi, Carla! Liberei o perfil de aprovação no SAP. Pode testar?", budget = 10) {
  const conversations = new ConversationService(new InMemoryConversationRepository(), new InMemoryMessageRepository(), fixedClock("2026-10-27T13:00:00Z"));
  const { id } = await conversations.getOrStart("carla");
  await conversations.handoff(id, { reason: "employee_request", summary: "SAP", ticketCode: "INC-20320", confidence: null });
  await conversations.assume(id, rafael);
  const writer = new FakeWriter(text);
  const suggestions = new FakeSuggestions();
  const service = new ReplySuggestionService(conversations, new FakeBudget(budget), writer, suggestions, 100);
  return { id, service, writer, suggestions };
}
const context = "Relatório: Carla precisa de perfil de aprovação no SAP (INC-20320).";

describe("sugestão de resposta para o analista", () => {
  it("quem assumiu recebe a sugestão, e ela fica registrada para medir o uso", async () => {
    const { id, service, suggestions } = await setup();
    const result = await service.suggest(id, rafael, context);
    expect(result).toEqual({ text: "Oi, Carla! Liberei o perfil de aprovação no SAP. Pode testar?", warnings: [] });
    expect(suggestions.events).toEqual(["generated"]);
  });

  it("outro analista não pede sugestão de conversa que não assumiu (nem gasta o modelo)", async () => {
    const { id, service, writer } = await setup();
    await expect(service.suggest(id, juliana, context)).rejects.toMatchObject({ code: "forbidden" });
    expect(writer.calls).toBe(0);
  });

  it("teto de custo atingido: não chama o modelo", async () => {
    const { id, service, writer } = await setup(undefined, 0);
    await expect(service.suggest(id, rafael, context)).rejects.toMatchObject({ code: "daily_limit" });
    expect(writer.calls).toBe(0);
  });

  it("número de chamado que não está na conversa vira aviso para o analista conferir", async () => {
    const { id, service } = await setup("Oi, Carla! Abri o REQ-99999 para o seu acesso.");
    const result = await service.suggest(id, rafael, context);
    expect(result.warnings).toEqual(["Cita o REQ-99999, que não aparece na conversa: confira antes de enviar."]);
  });

  it("ao enviar, registra se a sugestão foi usada igual ou editada", async () => {
    const { id, service, suggestions } = await setup();
    await service.recordSent(id, rafael, "Oi, Carla!", "Oi, Carla!");
    await service.recordSent(id, rafael, "Oi, Carla!", "Oi, Carla! Me avise se der certo.");
    expect(suggestions.events).toEqual(["sent_as_is", "sent_edited"]);
  });
});
