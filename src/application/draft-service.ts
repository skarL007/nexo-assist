/**
 * Rascunhos — o agent nunca cria ou altera um chamado direto.
 * Ele propõe um rascunho; o chamado só nasce quando o funcionário confirma
 * (pelo botão ou respondendo "pode criar" na conversa).
 */
import { isExplicitConfirmation } from "@/domain/confirmation";
import { describeChanges, MAX_DRAFTS_PER_CONVERSATION, reviseNewTicket, type NewTicketEdit } from "@/domain/draft-revision";
import { DomainError } from "@/domain/errors";
import type { Card, DraftSnapshot, DraftStatus, NewTicketFields, TicketUpdateFields, TraceStep, TurnTrace } from "@/domain/message";
import { SLA_LABEL, slaDeadline } from "@/domain/priority";
import { canReopen, categoryForTitle, CATEGORY_LABEL, sameSubject, type Category, type Ticket } from "@/domain/ticket";
import type { ConversationService } from "./conversation-service";
import { systemClock, type Clock, type Draft, type DraftRepository, type MessageRepository } from "./ports";
import type { TicketService } from "./ticket-service";

/** O que o formulário "Alterar detalhes" manda: campos do chamado novo ou o comentário da atualização. */
export type DraftEdit = NewTicketEdit | { comment: string };

export interface ConfirmResult {
  conversationId: string;
  ticket: Ticket;
  draft: DraftSnapshot;
  handedOff: boolean;
  /** Caso crítico em que o chamado foi criado, mas chamar o analista falhou: a resposta avisa. */
  escalationFailed?: boolean;
}

export class DraftService {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly tickets: TicketService,
    private readonly conversations: ConversationService,
    private readonly messages: MessageRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Um rascunho novo substitui o pendente anterior da conversa: confirmar os dois criaria chamados repetidos. */
  async proposeNewTicket(conversationId: string, employeeId: string, fields: NewTicketFields): Promise<DraftSnapshot> {
    await this.drafts.replacePending(conversationId);
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
    input: { ticketCode: string; comment: string; category?: Category },
  ): Promise<DraftSnapshot> {
    await this.assertSameProblem(employeeId, input.ticketCode, input.category, input.comment);
    const fields = await this.updateFields(employeeId, input.ticketCode, input.comment);
    await this.drafts.replacePending(conversationId);
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
   * "Alterar detalhes" pelo card: troca o rascunho por um novo com os campos do formulário e
   * responde com o resumo das mudanças, sem chamar o modelo. A prioridade é recalculada aqui
   * (impacto × urgência), nunca aceita do navegador. Continua sendo rascunho: nada é criado.
   */
  async reviseFromForm(draftId: number, employeeId: string, edit: DraftEdit): Promise<void> {
    const startedAt = Date.now();
    const current = await this.getPending(draftId, employeeId);
    if ((await this.drafts.listByConversation(current.conversationId)).length >= MAX_DRAFTS_PER_CONVERSATION) {
      throw new DomainError("message_limit", "Este rascunho já foi alterado muitas vezes. Confirme como está ou descreva o problema de novo no chat.");
    }
    const revision =
      current.kind === "create" ? await this.reviseTicket(current, employeeId, edit) : await this.reviseComment(current, employeeId, edit);

    // Reserva atômica: se o rascunho foi confirmado ou descartado nesse meio-tempo, não troca.
    await this.claim(draftId, employeeId, "replaced");
    const draft = await this.drafts.insert({
      conversationId: current.conversationId,
      employeeId,
      kind: current.kind,
      status: "pending",
      fields: revision.fields,
      createdAt: this.clock.now(),
    });
    await this.messages.add({
      conversationId: current.conversationId,
      role: "agent",
      text: revision.text,
      cards: [{ kind: "draft", draft: this.snapshot(draft) }, ...revision.cards],
      trace: systemTrace(
        [{ label: `alterou o rascunho D-${current.id} → D-${draft.id}`, detail: revision.summary, ok: true }, ...revision.steps],
        "Alteração feita pelo formulário do rascunho: o sistema recalculou a prioridade e o prazo, sem chamar o modelo.",
        startedAt,
      ),
    });
  }

  private async reviseTicket(current: Draft, employeeId: string, edit: DraftEdit): Promise<Revision> {
    if (!("impact" in edit)) throw new DomainError("invalid_input", "Este rascunho é de um chamado novo: altere os campos do chamado.");
    const before = current.fields as NewTicketFields;
    const { fields, changes } = reviseNewTicket(before, edit);
    if (changes.length === 0) throw new DomainError("invalid_input", "Nada mudou no rascunho.");

    const summary = describeChanges(changes);
    const steps: TraceStep[] = [
      { label: "classificou a prioridade", detail: fields.priorityReason, ok: true },
      { label: "consultou o SLA", detail: `${SLA_LABEL[fields.priority]} para a primeira resposta`, ok: true },
    ];
    const cards: Card[] = [];
    let text = `Atualizei o rascunho: ${summary}.`;

    // Mudou o que identifica o problema: confere de novo se já existe um chamado igual (Anexo A).
    if (before.type !== fields.type || before.category !== fields.category || before.title !== fields.title) {
      const duplicates = (await this.tickets.findPossibleDuplicates(employeeId, fields)).map((t) => this.tickets.snapshot(t));
      const codes = duplicates.map((t) => t.code).join(", ");
      steps.push({ label: "verificou duplicidade", detail: duplicates.length ? `Parecido(s): ${codes}` : "Nenhum chamado parecido aberto", ok: true });
      if (duplicates.length) {
        cards.push({ kind: "ticket_choice", tickets: duplicates });
        text += ` Antes de confirmar: você já tem o ${codes}, parecido com este. Se for o mesmo problema, escolha abaixo para eu atualizar em vez de abrir outro; se não for, é só confirmar.`;
        return { fields, summary, steps, cards, text };
      }
    }
    text += fields.priority === "critical" ? " Como é crítico, ao confirmar eu já chamo um analista." : " Confira e confirme.";
    return { fields, summary, steps, cards, text };
  }

  private async reviseComment(current: Draft, employeeId: string, edit: DraftEdit): Promise<Revision> {
    if (!("comment" in edit)) throw new DomainError("invalid_input", "Este rascunho é de uma atualização: altere o comentário.");
    const before = current.fields as TicketUpdateFields;
    const comment = edit.comment.trim();
    if (comment === before.comment) throw new DomainError("invalid_input", "Nada mudou no rascunho.");
    await this.assertSameProblem(employeeId, before.ticketCode, undefined, comment);
    const fields = await this.updateFields(employeeId, before.ticketCode, comment);
    return {
      fields,
      summary: "Comentário atualizado",
      steps: [],
      cards: [],
      text: `Atualizei o comentário que vai para o ${fields.ticketCode}. Confira e confirme.`,
    };
  }

  /** Problema de outro assunto vira chamado novo, não comentário no chamado existente. */
  private async assertSameProblem(employeeId: string, ticketCode: string, reported: Category | undefined, comment: string): Promise<void> {
    const ticket = await this.tickets.getMine(employeeId, ticketCode);
    // O texto de Outlook é evidência independente da categoria escolhida pelo modelo.
    if (categoryForTitle(comment, "other") === "email" && ticket.category !== "email" && ticket.category !== "access") {
      throw new DomainError("different_problem", `O ${ticket.code} é de ${CATEGORY_LABEL[ticket.category]}; o relato inclui um problema de E-mail. Proponha um chamado separado para o e-mail.`);
    }
    if (!reported) return;
    if (sameSubject(ticket.category, reported)) return;
    throw new DomainError(
      "different_problem",
      `O ${ticket.code} é sobre ${CATEGORY_LABEL[ticket.category]} ("${ticket.title}"), e o problema relatado é de ${CATEGORY_LABEL[reported]}. É outro problema: proponha um chamado novo em vez de atualizar este.`,
    );
  }

  /** Campos de uma atualização: o chamado precisa ser do funcionário e, se resolvido, estar na janela de 7 dias. */
  private async updateFields(employeeId: string, ticketCode: string, comment: string): Promise<TicketUpdateFields> {
    const ticket = await this.tickets.getMine(employeeId, ticketCode);
    const reopen = ticket.status === "resolved";
    if (reopen && !canReopen(ticket, this.clock.now())) {
      throw new DomainError("reopen_window_expired", `O ${ticket.code} foi resolvido há mais de 7 dias. É preciso abrir um novo chamado.`);
    }
    return { ticketCode: ticket.code, ticketTitle: ticket.title, comment, reopen };
  }

  /**
   * Confirma um rascunho.
   * - O rascunho é "reservado" de forma atômica: dois cliques (ou Ctrl+Enter repetido) criam um chamado só.
   * - Pelo agent (`fromTurn`), o rascunho precisa ser desta conversa, ter sido mostrado num turno anterior
   *   e a mensagem do funcionário precisa confirmar de forma explícita (o botão não passa por aqui).
   * - Se criar o chamado falhar, o rascunho volta a ficar pendente para tentar de novo.
   * - Depois que o chamado existe, nenhuma falha desfaz a confirmação: o próximo Confirmar duplicaria.
   */
  async confirm(
    draftId: number,
    employeeId: string,
    fromTurn?: { conversationId: string; startedAt: Date; employeeText: string },
  ): Promise<ConfirmResult> {
    if (fromTurn) {
      const draft = await this.getPending(draftId, employeeId);
      if (draft.conversationId !== fromTurn.conversationId || draft.createdAt >= fromTurn.startedAt) {
        throw new DomainError("draft_not_pending", "O funcionário ainda não viu este rascunho. Mostre e espere a confirmação.");
      }
      if (!isExplicitConfirmation(fromTurn.employeeText)) {
        throw new DomainError(
          "confirmation_required",
          'A última mensagem do funcionário não confirma o rascunho de forma explícita. Não diga que o chamado foi criado: responda ao que ele disse e peça para clicar em Confirmar no rascunho (ou responder "pode criar").',
        );
      }
    }
    const draft = await this.claim(draftId, employeeId, "confirmed");

    let ticket: Ticket;
    try {
      ticket = await this.commit(draft, employeeId);
    } catch (error) {
      // Nada foi gravado: o rascunho volta a ficar pendente para tentar de novo.
      await this.drafts.setStatus(draft.id, "pending");
      throw error;
    }
    const escalation =
      draft.kind === "create" && (draft.fields as NewTicketFields).priority === "critical"
        ? await this.escalate(draft, ticket, employeeId)
        : { ticket, handedOff: false, escalationFailed: false };
    return { conversationId: draft.conversationId, draft: this.snapshot({ ...draft, status: "confirmed" }), ...escalation };
  }

  /** Grava o chamado ou o comentário. Se falhar, nada ficou gravado. */
  private async commit(draft: Draft, employeeId: string): Promise<Ticket> {
    if (draft.kind === "update") {
      const fields = draft.fields as TicketUpdateFields;
      return this.tickets.addComment(employeeId, fields.ticketCode, fields.comment, fields.reopen);
    }
    return this.tickets.create(employeeId, draft.fields as NewTicketFields);
  }

  /**
   * Crítico vai para um analista, se a conversa ainda estiver com o agent. O chamado já existe,
   * então uma falha aqui não desfaz nada: a transferência vem primeiro (é a regra que importa)
   * e marcar o chamado como "aguardando analista" é só tentativa.
   */
  private async escalate(draft: Draft, ticket: Ticket, employeeId: string): Promise<{ ticket: Ticket; handedOff: boolean; escalationFailed: boolean }> {
    const fields = draft.fields as NewTicketFields;
    try {
      const conversation = await this.conversations.get(draft.conversationId);
      if (conversation.status !== "with_agent") return { ticket, handedOff: false, escalationFailed: false };
      await this.conversations.handoff(draft.conversationId, {
        reason: "critical",
        summary: `${ticket.code} · ${fields.title}. ${fields.description}`,
        ticketCode: ticket.code,
        confidence: null,
      });
    } catch {
      // Ex.: um analista assumiu nesse meio-tempo (então já há alguém), ou o banco falhou.
      const now = await this.conversations.get(draft.conversationId).catch(() => null);
      return { ticket, handedOff: false, escalationFailed: !now || now.status === "with_agent" };
    }
    const marked = await this.tickets.markTransferred(employeeId, ticket.code).catch(() => ticket);
    return { ticket: marked, handedOff: true, escalationFailed: false };
  }

  async cancel(draftId: number, employeeId: string): Promise<Draft> {
    return this.claim(draftId, employeeId, "cancelled");
  }

  /** Descarta os pendentes da conversa — ao encerrá-la, ou os criados num turno que falhou. */
  async cancelPending(conversationId: string, since?: Date): Promise<void> {
    await this.drafts.cancelPending(conversationId, since);
  }

  /** Confirmação pelo botão: confirma e registra a resposta do agent, sem chamar o modelo. */
  async confirmFromButton(draftId: number, employeeId: string): Promise<void> {
    const startedAt = Date.now();
    const { conversationId, ticket, draft, handedOff, escalationFailed } = await this.confirm(draftId, employeeId);
    const verb = draft.kind === "create" ? "Abri o" : ticket.status === "open" ? "Reabri e atualizei o" : "Atualizei o";
    const tail = handedOff
      ? " Como é um caso crítico, já chamei um analista para você."
      : escalationFailed
        ? " É um caso crítico, mas não consegui chamar o analista agora: peça \"falar com um analista\" que eu tento de novo."
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

  /** Reserva o rascunho; se não der, explica por quê sem revelar rascunho de outra pessoa. */
  private async claim(draftId: number, employeeId: string, status: DraftStatus): Promise<Draft> {
    const claimed = await this.drafts.claimPending(draftId, employeeId, status);
    if (claimed) return claimed;
    await this.getPending(draftId, employeeId); // lança not_found ou draft_not_pending
    throw new DomainError("draft_not_pending", "Este rascunho já foi confirmado ou descartado.");
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

interface Revision {
  fields: NewTicketFields | TicketUpdateFields;
  summary: string;
  steps: TraceStep[];
  cards: Card[];
  text: string;
}

function buttonTrace(label: string, startedAt: number): TurnTrace {
  return systemTrace([{ label, ok: true }], "Ação disparada pelo botão do rascunho: executada pelo sistema, sem chamar o modelo.", startedAt);
}

function systemTrace(steps: TraceStep[], guardrail: string, startedAt: number): TurnTrace {
  return { decision: null, steps, toolCalls: [], guardrails: [guardrail], model: null, usage: null, latencyMs: Date.now() - startedAt };
}
