import { describe, expect, it } from "vitest";
import type { NewTicketFields } from "@/domain/message";
import { ConversationService } from "./conversation-service";
import { DraftService } from "./draft-service";
import {
  fixedClock,
  InMemoryConversationRepository,
  InMemoryDraftRepository,
  InMemoryMessageRepository,
  InMemoryTicketRepository,
} from "./test-doubles";
import { TicketService } from "./ticket-service";

const clock = fixedClock("2026-10-27T13:00:00Z");

const fields: NewTicketFields = {
  type: "INC",
  title: "VPN não conecta — erro 809",
  description: "Desde ontem a VPN mostra o erro 809 no Windows 11.",
  category: "network",
  priority: "high",
  impact: "me",
  priorityReason: "Impacto: somente você · urgência: compromisso hoje → Alta",
};

async function setup() {
  const ticketRepo = new InMemoryTicketRepository();
  const messages = new InMemoryMessageRepository();
  const conversations = new ConversationService(new InMemoryConversationRepository(), messages, clock);
  const tickets = new TicketService(ticketRepo, { clock, retryDelayMs: 0 });
  const drafts = new DraftService(new InMemoryDraftRepository(), tickets, conversations, messages, clock);
  const conversation = await conversations.getOrStart("ana");
  return { ticketRepo, messages, conversations, drafts, conversation };
}

describe("rascunho antes de criar", () => {
  it("propor um rascunho não cria chamado", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    await drafts.proposeNewTicket(conversation.id, "ana", fields);
    expect(ticketRepo.tickets.size).toBe(0);
  });

  it("confirmar cria o chamado com a prioridade calculada", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    const { ticket } = await drafts.confirm(draft.id, "ana");
    expect(ticketRepo.tickets.get(ticket.code)?.priority).toBe("high");
  });

  it("o agent não confirma um rascunho que o funcionário ainda não viu", async () => {
    const { drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    // turno que começou antes (ou no mesmo instante) da criação do rascunho
    await expect(drafts.confirm(draft.id, "ana", clock.now())).rejects.toMatchObject({ code: "draft_not_pending" });
  });

  it("outra pessoa não confirma o rascunho da Ana", async () => {
    const { drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    await expect(drafts.confirm(draft.id, "carla")).rejects.toMatchObject({ code: "not_found" });
  });

  it("não confirma duas vezes", async () => {
    const { drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    await drafts.confirm(draft.id, "ana");
    await expect(drafts.confirm(draft.id, "ana")).rejects.toMatchObject({ code: "draft_not_pending" });
  });
});

describe("caso crítico", () => {
  it("transfere a conversa para um analista ao confirmar", async () => {
    const { drafts, conversations, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, priority: "critical", impact: "team" });
    const result = await drafts.confirm(draft.id, "ana");

    expect(result.handedOff).toBe(true);
    expect(result.ticket.status).toBe("waiting_analyst");
    expect((await conversations.get(conversation.id)).status).toBe("waiting_analyst");
  });
});
