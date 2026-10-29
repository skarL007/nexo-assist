import { describe, expect, it } from "vitest";
import { MAX_DRAFTS_PER_CONVERSATION } from "@/domain/draft-revision";
import { DomainError } from "@/domain/errors";
import type { NewTicketFields } from "@/domain/message";
import { ConversationService } from "./conversation-service";
import { DraftService } from "./draft-service";
import {
  fixedClock,
  makeTicket,
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

  it("um rascunho novo substitui o pendente anterior: confirmar os dois criaria dois chamados", async () => {
    // Achado no teste em produção: "é o monitor da direita" gerou o D-12, e o D-11 continuou pendente.
    const { ticketRepo, drafts, conversation } = await setup();
    const first = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    const revised = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, title: "VPN da filial não conecta — erro 809" });
    expect((await drafts.pending(conversation.id)).map((d) => d.id)).toEqual([revised.id]);
    // "Substituído", não "Descartado": quem descarta é o funcionário.
    expect((await drafts.statuses(conversation.id))[first.id]).toBe("replaced");
    await expect(drafts.confirm(first.id, "ana")).rejects.toMatchObject({ code: "draft_not_pending" });
    await drafts.confirm(revised.id, "ana");
    expect(ticketRepo.tickets.size).toBe(1);
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
    const sameTurn = { conversationId: conversation.id, startedAt: clock.now(), employeeText: "pode criar" };
    await expect(drafts.confirm(draft.id, "ana", sameTurn)).rejects.toMatchObject({ code: "draft_not_pending" });
  });

  it("o agent não confirma rascunho de outra conversa", async () => {
    const { drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    const otherTurn = { conversationId: "outra-conversa", startedAt: new Date("2099-01-01"), employeeText: "pode criar" };
    await expect(drafts.confirm(draft.id, "ana", otherTurn)).rejects.toMatchObject({ code: "draft_not_pending" });
  });

  it("pelo agent, só confirma quando a mensagem do funcionário confirma de forma explícita", async () => {
    // Achado do funcionário simulado (power-bi): a resposta rápida de urgência virou "sim" e o REQ foi criado.
    const { ticketRepo, drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    const nextTurn = { conversationId: conversation.id, startedAt: new Date("2026-10-27T13:05:00Z") };

    await expect(drafts.confirm(draft.id, "ana", { ...nextTurn, employeeText: "Tenho alternativa / Posso aguardar" })).rejects.toMatchObject({
      code: "confirmation_required",
    });
    expect(ticketRepo.tickets.size).toBe(0);
    expect((await drafts.statuses(conversation.id))[draft.id]).toBe("pending");

    await drafts.confirm(draft.id, "ana", { ...nextTurn, employeeText: "pode criar" });
    expect(ticketRepo.tickets.size).toBe(1);
  });

  it("o botão Confirmar não depende de texto", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    await drafts.confirmFromButton(draft.id, "ana");
    expect(ticketRepo.tickets.size).toBe(1);
  });

  it("dois cliques ao mesmo tempo criam um chamado só", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    const results = await Promise.allSettled([drafts.confirm(draft.id, "ana"), drafts.confirm(draft.id, "ana")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(ticketRepo.tickets.size).toBe(1);
  });

  it("se criar o chamado falhar, o rascunho volta a ficar pendente", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", fields);
    ticketRepo.insert = async () => {
      throw new Error("banco fora do ar");
    };
    await expect(drafts.confirm(draft.id, "ana")).rejects.toThrow("banco fora do ar");
    expect((await drafts.statuses(conversation.id))[draft.id]).toBe("pending");
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
  it("não quebra se a conversa já estiver com um analista: cria o chamado sem transferir de novo", async () => {
    const { drafts, conversations, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, priority: "critical", impact: "team" });
    await conversations.handoff(conversation.id, { reason: "employee_request", summary: "pediu", ticketCode: null, confidence: null });

    const result = await drafts.confirm(draft.id, "ana");
    expect(result.handedOff).toBe(false);
    expect((await drafts.statuses(conversation.id))[draft.id]).toBe("confirmed");
  });

  it("transfere a conversa para um analista ao confirmar", async () => {
    const { drafts, conversations, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, priority: "critical", impact: "team" });
    const result = await drafts.confirm(draft.id, "ana");

    expect(result.handedOff).toBe(true);
    expect(result.ticket.status).toBe("waiting_analyst");
    expect((await conversations.get(conversation.id)).status).toBe("waiting_analyst");
  });
});

describe("alterar detalhes pelo card do rascunho", () => {
  const companyWide: NewTicketFields = {
    ...fields,
    title: "Monitores sem sinal",
    description: "Os monitores de vídeo não ligam desde hoje cedo, sem sinal.",
    category: "hardware",
    impact: "company",
    urgency: "blocked",
    priority: "critical",
    priorityReason: "Impacto: toda a empresa · urgência: impede de trabalhar → Crítica",
  };
  const edit = { type: "INC", category: "hardware", title: companyWide.title, description: companyWide.description, impact: "company", urgency: "blocked" } as const;

  it("troca o rascunho por um novo com a prioridade recalculada, sem criar chamado e sem chamar o modelo", async () => {
    const { ticketRepo, messages, drafts, conversation } = await setup();
    const original = await drafts.proposeNewTicket(conversation.id, "ana", companyWide);

    await drafts.reviseFromForm(original.id, "ana", { ...edit, impact: "me" });

    const [revised] = await drafts.pending(conversation.id);
    expect(revised.kind === "create" && revised.fields.priority).toBe("high");
    expect((await drafts.statuses(conversation.id))[original.id]).toBe("replaced");
    expect(ticketRepo.tickets.size).toBe(0);

    const reply = messages.items.at(-1)!;
    expect(reply.role).toBe("agent");
    expect(reply.text).toContain("Afetados: Toda a empresa → Somente você · Prioridade: Crítica → Alta");
    expect(reply.cards).toContainEqual(expect.objectContaining({ kind: "draft", draft: expect.objectContaining({ id: revised.id }) }));
    expect(reply.trace?.usage).toBeNull();
    expect(reply.trace?.steps.map((step) => step.label)).toContain("classificou a prioridade");
  });

  it("recalcula a prioridade no servidor: a prévia do navegador não manda", async () => {
    const { drafts, conversation } = await setup();
    const original = await drafts.proposeNewTicket(conversation.id, "ana", companyWide);
    await drafts.reviseFromForm(original.id, "ana", { ...edit, impact: "me", priority: "critical" } as never);
    const [revised] = await drafts.pending(conversation.id);
    expect(revised.kind === "create" && revised.fields.priority).toBe("high");
  });

  it("sem mudança, recusa", async () => {
    const { drafts, conversation } = await setup();
    const original = await drafts.proposeNewTicket(conversation.id, "ana", companyWide);
    await expect(drafts.reviseFromForm(original.id, "ana", edit)).rejects.toMatchObject({ code: "invalid_input" });
    expect((await drafts.statuses(conversation.id))[original.id]).toBe("pending");
  });

  it("não altera rascunho já confirmado nem o de outra pessoa", async () => {
    const { drafts, conversation } = await setup();
    const original = await drafts.proposeNewTicket(conversation.id, "ana", companyWide);
    await expect(drafts.reviseFromForm(original.id, "bruno", { ...edit, impact: "me" })).rejects.toMatchObject({ code: "not_found" });
    await drafts.confirm(original.id, "ana");
    await expect(drafts.reviseFromForm(original.id, "ana", { ...edit, impact: "me" })).rejects.toMatchObject({ code: "draft_not_pending" });
  });

  it("campos que não são deste tipo de rascunho são recusados", async () => {
    const { drafts, conversation } = await setup();
    const original = await drafts.proposeNewTicket(conversation.id, "ana", companyWide);
    await expect(drafts.reviseFromForm(original.id, "ana", { comment: "outra coisa qualquer" })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rascunho de atualização: troca o comentário", async () => {
    const { ticketRepo, messages, drafts, conversation } = await setup();
    await ticketRepo.insert(makeTicket({ code: "INC-20311", status: "open" }));
    const original = await drafts.proposeUpdate(conversation.id, "ana", { ticketCode: "INC-20311", comment: "Continua lento." });

    await drafts.reviseFromForm(original.id, "ana", { comment: "Continua lento, inclusive depois de reiniciar." });

    const [revised] = await drafts.pending(conversation.id);
    expect(revised.kind === "update" && revised.fields.comment).toBe("Continua lento, inclusive depois de reiniciar.");
    expect(messages.items.at(-1)!.text).toContain("INC-20311");
  });

  it("se a mudança deixar o rascunho parecido com um chamado aberto, mostra o parecido para escolher (sem duplicidade)", async () => {
    const { ticketRepo, messages, drafts, conversation } = await setup();
    await ticketRepo.insert(makeTicket({ code: "INC-20400", title: "Monitor da direita não liga", status: "open" }));
    const original = await drafts.proposeNewTicket(conversation.id, "ana", { ...companyWide, category: "other", title: "Tela sem imagem" });

    await drafts.reviseFromForm(original.id, "ana", { ...edit, category: "hardware", title: "Monitor da direita sem sinal" });

    const reply = messages.items.at(-1)!;
    expect(reply.cards).toContainEqual(expect.objectContaining({ kind: "ticket_choice", tickets: [expect.objectContaining({ code: "INC-20400" })] }));
    expect(reply.text).toContain("INC-20400");
  });
});

describe("sistema de chamados instável depois de gravar (sem duplicidade)", () => {
  const down = () => Promise.reject(new DomainError("legacy_unavailable", "O sistema de chamados está indisponível no momento."));

  it("crítico: se marcar o chamado falhar depois de criá-lo, o rascunho fica confirmado e não dá para criar de novo", async () => {
    // Achado da auditoria: o rascunho voltava a "pendente" e o segundo Confirmar criava outro chamado.
    const { ticketRepo, drafts, conversations, conversation } = await setup();
    ticketRepo.update = down;
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, priority: "critical", impact: "team" });

    const result = await drafts.confirm(draft.id, "ana");

    expect(ticketRepo.tickets.size).toBe(1);
    expect(result.handedOff).toBe(true);
    expect((await conversations.get(conversation.id)).status).toBe("waiting_analyst");
    expect((await drafts.statuses(conversation.id))[draft.id]).toBe("confirmed");
    await expect(drafts.confirm(draft.id, "ana")).rejects.toMatchObject({ code: "draft_not_pending" });
    expect(ticketRepo.tickets.size).toBe(1);
  });

  it("crítico: se a transferência falhar, o chamado continua criado e a resposta avisa", async () => {
    const { ticketRepo, messages, drafts, conversations, conversation } = await setup();
    conversations.handoff = down;
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, priority: "critical", impact: "team" });

    await drafts.confirmFromButton(draft.id, "ana");

    expect(ticketRepo.tickets.size).toBe(1);
    expect((await drafts.statuses(conversation.id))[draft.id]).toBe("confirmed");
    expect(messages.items.at(-1)!.text).toContain("não consegui chamar o analista");
  });

  it("atualização: falha no meio não grava o comentário pela metade, e tentar de novo não duplica", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    await ticketRepo.insert(makeTicket({ code: "INC-20311", status: "open" }));
    const draft = await drafts.proposeUpdate(conversation.id, "ana", { ticketCode: "INC-20311", comment: "Continua lento." });
    const update = ticketRepo.update.bind(ticketRepo);
    ticketRepo.update = down;

    await expect(drafts.confirm(draft.id, "ana")).rejects.toMatchObject({ code: "legacy_unavailable" });
    expect(ticketRepo.comments).toHaveLength(0);

    ticketRepo.update = update;
    await drafts.confirm(draft.id, "ana");
    expect(ticketRepo.comments).toHaveLength(1);
  });
});

describe("crítico com o banco fora do ar na transferência", () => {
  it("se nem a conversa puder ser lida, avisa que não chamou o analista (não diz que está tudo bem)", async () => {
    const { ticketRepo, messages, drafts, conversations, conversation } = await setup();
    const draft = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, priority: "critical", impact: "team" });
    conversations.handoff = () => Promise.reject(new Error("banco fora do ar"));
    const get = conversations.get.bind(conversations);
    let calls = 0;
    conversations.get = (id: string) => (++calls > 1 ? Promise.reject(new Error("banco fora do ar")) : get(id));

    await drafts.confirmFromButton(draft.id, "ana");

    expect(ticketRepo.tickets.size).toBe(1);
    expect(messages.items.at(-1)!.text).toContain("não consegui chamar o analista");
  });
});

describe("limite de alterações pelo card (achado A1 da auditoria de segurança)", () => {
  it("depois de muitos rascunhos na conversa, recusa novas alterações em vez de gravar sem fim", async () => {
    const { drafts, conversation } = await setup();
    const first = await drafts.proposeNewTicket(conversation.id, "ana", { ...fields, urgency: "deadline_today" });
    const base = { type: fields.type, category: fields.category, title: fields.title, description: fields.description, impact: fields.impact } as const;
    let current = first.id;
    for (let i = 1; i < MAX_DRAFTS_PER_CONVERSATION; i++) {
      await drafts.reviseFromForm(current, "ana", { ...base, urgency: i % 2 ? "blocked" : "deadline_today" });
      current = (await drafts.pending(conversation.id))[0].id;
    }
    await expect(drafts.reviseFromForm(current, "ana", { ...base, urgency: "none" })).rejects.toMatchObject({ code: "message_limit" });
    expect((await drafts.statuses(conversation.id))[current]).toBe("pending");
  });
});

describe("atualização só para o mesmo problema", () => {
  it.each(["hardware", "software"] as const)("relato misto de computador e Outlook não atualiza Hardware mesmo classificado como %s", async (category) => {
    const { ticketRepo, drafts, conversation } = await setup();
    await ticketRepo.insert(makeTicket({ code: "INC-20311", status: "open" }));
    await expect(drafts.proposeUpdate(conversation.id, "ana", {
      ticketCode: "INC-20311", comment: "O computador e o Outlook não abrem desde a atualização.", category,
    })).rejects.toMatchObject({ code: "different_problem" });
    expect(await drafts.pending(conversation.id)).toEqual([]);
    expect(ticketRepo.comments).toEqual([]);
  });

  it("problema de outra categoria não vira comentário no chamado existente (Outlook no INC-20311 de Hardware)", async () => {
    // Achado do funcionário simulado (vago-outlook): "Outlook não abre" foi parar no chamado de notebook lento.
    const { ticketRepo, drafts, conversation } = await setup();
    await ticketRepo.insert(makeTicket({ code: "INC-20311", status: "open" }));
    await expect(
      drafts.proposeUpdate(conversation.id, "ana", { ticketCode: "INC-20311", comment: "O Outlook não abre desde ontem.", category: "email" }),
    ).rejects.toMatchObject({ code: "different_problem" });
    expect(await drafts.pending(conversation.id)).toEqual([]);
  });

  it("mesmo assunto continua permitido (Excel travando no notebook lento)", async () => {
    const { ticketRepo, drafts, conversation } = await setup();
    await ticketRepo.insert(makeTicket({ code: "INC-20311", status: "open" }));
    const draft = await drafts.proposeUpdate(conversation.id, "ana", { ticketCode: "INC-20311", comment: "Agora trava ao abrir o Excel.", category: "software" });
    expect(draft.kind).toBe("update");
  });
});
