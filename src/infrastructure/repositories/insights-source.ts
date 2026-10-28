import { count, eq, gte, ne } from "drizzle-orm";
import type { InsightsSource } from "@/application/ports";
import type { ChatMessage, DraftStatus } from "@/domain/message";
import type { Priority, TicketStatus } from "@/domain/ticket";
import type { Database } from "../db/client";
import { drafts, employees, messageFeedback, messages, tickets } from "../db/schema";

/** Leituras dos indicadores. O deploy tem teto de 100 mensagens por dia, então ler a janela inteira é barato. */
export class DrizzleInsightsSource implements InsightsSource {
  constructor(private readonly db: Database) {}

  async messagesSince(since: Date): Promise<ChatMessage[]> {
    const rows = await this.db.select().from(messages).where(gte(messages.createdAt, since));
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }

  async feedbackSince(since: Date): Promise<{ helpful: boolean }[]> {
    return this.db.select({ helpful: messageFeedback.helpful }).from(messageFeedback).where(gte(messageFeedback.createdAt, since));
  }

  async draftStatusesSince(since: Date): Promise<{ status: DraftStatus }[]> {
    return this.db.select({ status: drafts.status }).from(drafts).where(gte(drafts.createdAt, since));
  }

  async openTickets(): Promise<{ code: string; title: string; priority: Priority; status: TicketStatus; updatedAt: Date; ownerName: string }[]> {
    return this.db
      .select({ code: tickets.code, title: tickets.title, priority: tickets.priority, status: tickets.status, updatedAt: tickets.updatedAt, ownerName: employees.name })
      .from(tickets)
      .innerJoin(employees, eq(tickets.ownerId, employees.id))
      .where(ne(tickets.status, "resolved"));
  }

  async countAnalysts(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(employees).where(eq(employees.role, "analyst"));
    return row?.total ?? 0;
  }
}
