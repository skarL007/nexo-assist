/**
 * Rascunhos — o agent nunca cria ou altera um chamado direto.
 * Ele propõe um rascunho; o chamado só nasce quando o funcionário confirma
 * (pelo botão ou respondendo "pode criar" na conversa).
 */
import { DomainError } from "@/domain/errors";
import type { DraftSnapshot, DraftStatus, NewTicketFields, TicketUpdateFields, TurnTrace } from "@/domain/message";
import { slaDeadline } from "@/domain/priority";
import { canReopen, type Ticket } from "@/domain/ticket";
import type { ConversationService } from "./conversation-service";
import { systemClock, type Clock, type Draft, type DraftRepository, type MessageRepository } from "./ports";
import type { TicketService } from "./ticket-service";

export interface ConfirmResult {
  conversationId: string;
  ticket: Ticket;
  draft: DraftSnapshot;
  handedOff: boolean;
}

export class DraftService {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly tickets: TicketService,
    private readonly conversations: ConversationService,
    private readonly messages: MessageRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async proposeNewTicket(conversationId: string, employeeId: string, fields: NewTicketFields): Promise<DraftSnapshot> {
    const draft = await this.drafts.insert({
      conversationId,
      employeeId,
      kind: "create",
      status: "pending",
      fields,
      createdAt: this.clock.now(),
    });
    return this.snapshot(draft);
  }

  async proposeUpdate(
    conversationId: string,
    employeeId: string,
    input: { ticketCode: string; comment: string },
  ): Promise<DraftSnapshot> {
    const ticket = await this.tickets.getMine(employeeId, input.ticketCode);
    const reopen = ticket.status === "resolved";
    if (reopen && !canReopen(ticket, this.clock.now())) {
      throw new DomainError("reopen_window_expired", `O ${ticket.code} foi resolvido há mais de 7 dias. É preciso abrir um novo chamado.`);
    }
    const fields: TicketUpdateFields = { ticketCode: ticket.code, ticketTitle: ticket.title, comment: input.comment, reopen };
    const draft = await this.drafts.insert({
      conversationId,
      employeeId,
      kind: "update",
      status: "pending",
      fields,
      createdAt: this.clock.now(),
    });
    return this.snapshot(draft);
  }

  /**
   * Confirma um rascunho. `shownBefore` impede que o agent crie e confirme
   * o mesmo rascunho na mesma resposta: o funcionário precisa tê-lo visto.
   */
  async confirm(draftId: number, employeeId: string, shownBefore?: Date): Promise<ConfirmResult> {
    const draft = await this.getPending(draftId, employeeId);
    if (shownBefore && draft.createdAt >= shownBefore) {
      throw new DomainError("draft_not_pending", "O funcionário ainda não viu este rascunho. Mostre e espere a confirmação.");
    }

    let ticket: Ticket;
    let handedOff = false;
    if (draft.kind === "create") {
      const fields = draft.fields as NewTicketFields;
      ticket = await this.tickets.create(employeeId, fields);
      if (fields.priority === "critical") {
        ticket = await this.tickets.markTransferred(employeeId, ticket.code);
        await this.conversations.handoff(draft.conversationId, {
          reason: "critical",
          summary: `${ticket.code} · ${fields.title}. ${fields.description}`,
          ticketCode: ticket.code,
          confidence: null,
        });
        handedOff = true;
      }
    } else {
      const fields = draft.fields as TicketUpdateFields;
      ticket = await this.tickets.addComment(employeeId, fields.ticketCode, fields.comment, fields.reopen);
    }

    await this.drafts.setStatus(draft.id, "confirmed");
    return { conversationId: draft.conversationId, ticket, draft: this.snapshot({ ...draft, status: "confirmed" }), handedOff };
  }

  async cancel(draftId: number, employeeId: string): Promise<Draft> {
    const draft = await this.getPending(draftId, employeeId);
    await this.drafts.setStatus(draft.id, "cancelled");
    return draft;
  }

  /** Confirmação pelo botão: confirma e registra a resposta do agent, sem chamar o modelo. */
  async confirmFromButton(draftId: number, employeeId: string): Promise<void> {
    const startedAt = Date.now();
    const { conversationId, ticket, draft, handedOff } = await this.confirm(draftId, employeeId);
    const verb = draft.kind === "create" ? "Abri o" : ticket.status === "open" ? "Reabri e atualizei o" : "Atualizei o";
    const tail = handedOff
      ? " Como é um caso crítico, já chamei um analista para você."
      : " Você pode acompanhar por aqui quando quiser.";

    await this.messages.add({
      conversationId,
      role: "agent",
      text: `Pronto! ${verb} ${ticket.code}.${tail}`,
      cards: [{ kind: "ticket", ticket: this.tickets.snapshot(ticket) }],
      trace: buttonTrace(`${draft.kind === "create" ? "criou" : "atualizou"} o ${ticket.code}`, startedAt),
    });
  }

  async cancelFromButton(draftId: number, employeeId: string): Promise<void> {
    const startedAt = Date.now();
    const { conversationId } = await this.cancel(draftId, employeeId);
    await this.messages.add({
      conversationId,
      role: "agent",
      text: "Tudo bem, descartei o rascunho. Se quiser, me conte o que mudar.",
      trace: buttonTrace(`descartou o rascunho D-${draftId}`, startedAt),
    });
  }

  async statuses(conversationId: string): Promise<Record<number, DraftStatus>> {
    const drafts = await this.drafts.listByConversation(conversationId);
    return Object.fromEntries(drafts.map((d) => [d.id, d.status]));
  }

  async pending(conversationId: string): Promise<DraftSnapshot[]> {
    const drafts = await this.drafts.listByConversation(conversationId);
    return drafts.filter((d) => d.status === "pending").map((d) => this.snapshot(d));
  }

  private async getPending(draftId: number, employeeId: string): Promise<Draft> {
    const draft = await this.drafts.findById(draftId);
    if (!draft || draft.employeeId !== employeeId) throw new DomainError("not_found", "Rascunho não encontrado.");
    if (draft.status !== "pending") throw new DomainError("draft_not_pending", "Este rascunho já foi confirmado ou descartado.");
    return draft;
  }

  private snapshot(draft: Draft): DraftSnapshot {
    if (draft.kind === "create") {
      const fields = draft.fields as NewTicketFields;
      const deadline = slaDeadline(fields.priority, this.clock.now()).toISOString();
      return { id: draft.id, kind: "create", status: draft.status, fields, deadline };
    }
    return { id: draft.id, kind: "update", status: draft.status, fields: draft.fields as TicketUpdateFields };
  }
}

function buttonTrace(label: string, startedAt: number): TurnTrace {
  return {
    decision: null,
    steps: [{ label, ok: true }],
    toolCalls: [],
    guardrails: ["Ação disparada pelo botão do rascunho: executada pelo sistema, sem chamar o modelo."],
    model: null,
    usage: null,
    latencyMs: Date.now() - startedAt,
  };
}
