/** Implementações em memória das portas, usadas só nos testes. */
import type { Ticket, TicketType } from "@/domain/ticket";
import type { Clock, TicketRepository } from "./ports";

export class InMemoryTicketRepository implements TicketRepository {
  readonly tickets = new Map<string, Ticket>();
  readonly comments: { ticketCode: string; text: string }[] = [];
  private sequence = 30000;

  constructor(initial: Ticket[] = []) {
    initial.forEach((t) => this.tickets.set(t.code, t));
  }

  async findByCode(code: string) {
    return this.tickets.get(code) ?? null;
  }
  async listByOwner(ownerId: string) {
    return [...this.tickets.values()].filter((t) => t.ownerId === ownerId);
  }
  async nextCode(type: TicketType) {
    return `${type}-${++this.sequence}`;
  }
  async insert(ticket: Ticket) {
    this.tickets.set(ticket.code, ticket);
  }
  async update(ticket: Ticket) {
    this.tickets.set(ticket.code, ticket);
  }
  async addComment(ticketCode: string, _author: string, text: string) {
    this.comments.push({ ticketCode, text });
  }
}

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const at = new Date("2026-10-20T13:00:00Z");
  return {
    code: "INC-20311",
    type: "INC",
    title: "Notebook lento após atualização do Windows",
    description: "Lentidão geral desde a atualização.",
    category: "hardware",
    priority: "medium",
    status: "waiting_analyst",
    impact: "me",
    ownerId: "ana",
    createdAt: at,
    updatedAt: at,
    resolvedAt: null,
    ...overrides,
  };
}
