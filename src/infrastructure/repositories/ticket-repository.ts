import { and, desc, eq, gte, like, ne, sql } from "drizzle-orm";
import type { TicketRepository } from "@/application/ports";
import { DomainError } from "@/domain/errors";
import type { Ticket, TicketType } from "@/domain/ticket";
import type { Database } from "../db/client";
import { ticketComments, tickets } from "../db/schema";
import { demoScopeWhere } from "./demo-scope";

/** Primeiro número de cada tipo quando ainda não há chamados. */
const FIRST_NUMBER: Record<TicketType, number> = { INC: 20000, REQ: 10000 };

export class DrizzleTicketRepository implements TicketRepository {
  constructor(private readonly db: Database, private readonly demoScope?: string) {}

  async findByCode(code: string): Promise<Ticket | null> {
    const row = await this.db.query.tickets.findFirst({ where: eq(tickets.code, code) });
    return row ?? null;
  }

  async listByOwner(ownerId: string): Promise<Ticket[]> {
    return this.db.select().from(tickets).where(eq(tickets.ownerId, ownerId)).orderBy(desc(tickets.updatedAt));
  }

  async listOpenCreatedSince(since: Date): Promise<Ticket[]> {
    return this.db.select().from(tickets).where(and(ne(tickets.status, "resolved"), gte(tickets.createdAt, since), demoScopeWhere(tickets.ownerId, this.demoScope)));
  }

  async nextCode(type: TicketType): Promise<string> {
    const [row] = await this.db
      .select({ highest: sql<number | null>`max(cast(substr(${tickets.code}, 5) as integer))` })
      .from(tickets)
      .where(like(tickets.code, `${type}-%`));
    return `${type}-${Math.max(row?.highest ?? 0, FIRST_NUMBER[type]) + 1}`;
  }

  async findByIdempotencyKey(key: string): Promise<Ticket | null> {
    const row = await this.db.query.tickets.findFirst({ where: eq(tickets.idempotencyKey, key) });
    return row ?? null;
  }

  /**
   * Se dois chamados pegarem o mesmo número ao mesmo tempo, avisa com "conflict" (o serviço tenta de novo).
   * Chave da operação repetida também dá "conflict": na nova tentativa, o serviço acha o chamado pela chave.
   */
  async insert(ticket: Ticket, idempotencyKey?: string): Promise<void> {
    try {
      await this.db.insert(tickets).values({ ...ticket, idempotencyKey: idempotencyKey ?? null });
    } catch (error) {
      // O Drizzle embrulha o erro do banco: a mensagem dele é a consulta; o "UNIQUE" está na causa.
      if (/UNIQUE/.test(String((error as Error).cause ?? error))) {
        throw new DomainError("conflict", `O código ${ticket.code} acabou de ser usado.`);
      }
      throw error;
    }
  }

  async update(ticket: Ticket): Promise<void> {
    await this.db.update(tickets).set(ticket).where(eq(tickets.code, ticket.code));
  }

  /** Com chave, a repetição da mesma operação é ignorada pelo UNIQUE (sem erro: o comentário já está lá). */
  async addComment(ticketCode: string, author: string, text: string, at: Date, idempotencyKey?: string): Promise<void> {
    await this.db
      .insert(ticketComments)
      .values({ ticketCode, author, text, createdAt: at, idempotencyKey: idempotencyKey ?? null })
      .onConflictDoNothing({ target: ticketComments.idempotencyKey });
  }
}
