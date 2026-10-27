import { desc, eq, like } from "drizzle-orm";
import type { TicketRepository } from "@/application/ports";
import type { Ticket, TicketType } from "@/domain/ticket";
import type { Database } from "../db/client";
import { ticketComments, tickets } from "../db/schema";

/** Primeiro número de cada tipo quando ainda não há chamados. */
const FIRST_NUMBER: Record<TicketType, number> = { INC: 20000, REQ: 10000 };

export class DrizzleTicketRepository implements TicketRepository {
  constructor(private readonly db: Database) {}

  async findByCode(code: string): Promise<Ticket | null> {
    const row = await this.db.query.tickets.findFirst({ where: eq(tickets.code, code) });
    return row ?? null;
  }

  async listByOwner(ownerId: string): Promise<Ticket[]> {
    return this.db.select().from(tickets).where(eq(tickets.ownerId, ownerId)).orderBy(desc(tickets.updatedAt));
  }

  async nextCode(type: TicketType): Promise<string> {
    const rows = await this.db.select({ code: tickets.code }).from(tickets).where(like(tickets.code, `${type}-%`));
    const highest = rows.reduce((max, row) => Math.max(max, Number(row.code.split("-")[1])), FIRST_NUMBER[type]);
    return `${type}-${highest + 1}`;
  }

  async insert(ticket: Ticket): Promise<void> {
    await this.db.insert(tickets).values(ticket);
  }

  async update(ticket: Ticket): Promise<void> {
    await this.db.update(tickets).set(ticket).where(eq(tickets.code, ticket.code));
  }

  async addComment(ticketCode: string, author: string, text: string, at: Date): Promise<void> {
    await this.db.insert(ticketComments).values({ ticketCode, author, text, createdAt: at });
  }
}
