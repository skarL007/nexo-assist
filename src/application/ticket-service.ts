/**
 * Serviço de chamados — consultar, criar, atualizar e transferir.
 *
 * É o único caminho para os chamados: o agent e as rotas HTTP passam por aqui.
 * Toda leitura recebe o id do funcionário e filtra por dono (privacidade).
 * O sistema legado às vezes cai por alguns segundos: cada chamada é repetida
 * com backoff antes de desistir.
 */
import { DomainError } from "@/domain/errors";
import type { NewTicketFields, TicketSnapshot } from "@/domain/message";
import { ticketSla } from "@/domain/priority";
import { canReopen, isOpen, sameProblem, type Ticket } from "@/domain/ticket";
import { withRetry } from "@/lib/retry";
import { systemClock, type Clock, type TicketRepository } from "./ports";

export interface TicketServiceOptions {
  clock?: Clock;
  onRetry?: (attempt: number) => void;
  retryDelayMs?: number;
}

export class TicketService {
  private readonly clock: Clock;

  constructor(
    private readonly repo: TicketRepository,
    private readonly options: TicketServiceOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async listMine(employeeId: string, { openOnly = false } = {}): Promise<Ticket[]> {
    const tickets = await this.call(() => this.repo.listByOwner(employeeId));
    const filtered = openOnly ? tickets.filter(isOpen) : tickets;
    return filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /** Resolvidos há até 7 dias: ainda podem ser reabertos (Anexo A). */
  async listReopenable(employeeId: string): Promise<Ticket[]> {
    const now = this.clock.now();
    return (await this.listMine(employeeId)).filter((t) => canReopen(t, now));
  }

  /** Chamado de outra pessoa responde "não encontrado" — nem confirma que existe. */
  async getMine(employeeId: string, code: string): Promise<Ticket> {
    const ticket = await this.call(() => this.repo.findByCode(code.trim().toUpperCase()));
    if (!ticket || ticket.ownerId !== employeeId) {
      throw new DomainError("not_found", `Não encontrei o chamado ${code} entre os seus.`);
    }
    return ticket;
  }

  /** Abertos, ou resolvidos há até 7 dias (podem ser reabertos), que parecem o mesmo problema. */
  async findPossibleDuplicates(employeeId: string, candidate: Pick<Ticket, "type" | "category" | "title">): Promise<Ticket[]> {
    const now = this.clock.now();
    const mine = await this.listMine(employeeId);
    return mine.filter((t) => sameProblem(t, candidate) && (isOpen(t) || canReopen(t, now)));
  }

  async create(employeeId: string, fields: NewTicketFields): Promise<Ticket> {
    // Dois chamados criados no mesmo instante podem pegar o mesmo número: tenta o próximo.
    return withRetry(() => this.createOnce(employeeId, fields), {
      attempts: 3,
      baseDelayMs: 0,
      shouldRetry: (error) => error instanceof DomainError && error.code === "conflict",
    });
  }

  private async createOnce(employeeId: string, fields: NewTicketFields): Promise<Ticket> {
    const now = this.clock.now();
    const code = await this.call(() => this.repo.nextCode(fields.type));
    const ticket: Ticket = {
      code,
      type: fields.type,
      title: fields.title,
      description: fields.description,
      category: fields.category,
      priority: fields.priority,
      impact: fields.impact,
      status: "open",
      ownerId: employeeId,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    await this.call(() => this.repo.insert(ticket));
    return ticket;
  }

  async addComment(employeeId: string, code: string, comment: string, reopen: boolean): Promise<Ticket> {
    const now = this.clock.now();
    const ticket = await this.getMine(employeeId, code);

    let status = ticket.status;
    let resolvedAt = ticket.resolvedAt;
    if (ticket.status === "resolved") {
      if (!reopen || !canReopen(ticket, now)) {
        throw new DomainError("reopen_window_expired", `O ${code} foi resolvido há mais de 7 dias. É preciso abrir um novo chamado.`);
      }
      status = "open";
      resolvedAt = null;
    }

    const updated: Ticket = { ...ticket, status, resolvedAt, updatedAt: now };
    await this.call(() => this.repo.addComment(code, "employee", comment, now));
    await this.call(() => this.repo.update(updated));
    return updated;
  }

  async markTransferred(employeeId: string, code: string): Promise<Ticket> {
    const ticket = await this.getMine(employeeId, code);
    if (!isOpen(ticket)) return ticket;
    const updated: Ticket = { ...ticket, status: "waiting_analyst" };
    await this.call(() => this.repo.update(updated));
    return updated;
  }

  snapshot(ticket: Ticket): TicketSnapshot {
    const sla = ticketSla(ticket, this.clock.now());
    return {
      code: ticket.code,
      type: ticket.type,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      impact: ticket.impact,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      deadline: sla ? sla.deadline.toISOString() : null,
      overdue: sla?.overdue ?? false,
    };
  }

  private call<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(fn, {
      attempts: 3,
      baseDelayMs: this.options.retryDelayMs ?? 200,
      shouldRetry: (error) => error instanceof DomainError && error.code === "legacy_unavailable",
      onRetry: (attempt) => this.options.onRetry?.(attempt),
    });
  }
}
