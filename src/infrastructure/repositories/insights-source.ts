import { and, count, eq, gte, inArray, ne } from "drizzle-orm";
import type { InsightsSource } from "@/application/ports";
import type { ChatMessage, DraftStatus } from "@/domain/message";
import type { Priority, TicketStatus } from "@/domain/ticket";
import type { Database } from "../db/client";
import { conversations, drafts, employees, messageFeedback, messages, tickets } from "../db/schema";
import { demoScopeWhere } from "./demo-scope";

/** Leituras dos indicadores. O deploy tem teto de 100 mensagens por dia, então ler a janela inteira é barato. */
export class DrizzleInsightsSource implements InsightsSource {
  constructor(private readonly db: Database, private readonly demoScope?: string) {}

  async messagesSince(since: Date): Promise<ChatMessage[]> {
    const rows = await this.db.select({message:messages}).from(messages).innerJoin(conversations,eq(messages.conversationId,conversations.id)).where(and(gte(messages.createdAt, since),demoScopeWhere(conversations.employeeId,this.demoScope)));
    return rows.map(({message:row}) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }

  async feedbackSince(since: Date): Promise<{ helpful: boolean; messageId: string; conversationId: string }[]> {
    return this.db
      .select({ helpful: messageFeedback.helpful, messageId: messageFeedback.messageId, conversationId: messages.conversationId })
      .from(messageFeedback)
      .innerJoin(messages, eq(messageFeedback.messageId, messages.id))
      .innerJoin(conversations,eq(messages.conversationId,conversations.id))
      .where(and(gte(messageFeedback.createdAt, since),demoScopeWhere(conversations.employeeId,this.demoScope)));
  }

  async draftStatusesSince(since: Date): Promise<{ status: DraftStatus; conversationId: string }[]> {
    return this.db.select({ status: drafts.status, conversationId: drafts.conversationId }).from(drafts).where(and(gte(drafts.createdAt, since),demoScopeWhere(drafts.employeeId,this.demoScope)));
  }

  async conversationOwners(ids: string[]): Promise<{ id: string; employeeId: string }[]> {
    if (!ids.length) return [];
    return this.db.select({ id: conversations.id, employeeId: conversations.employeeId }).from(conversations).where(and(inArray(conversations.id, ids),demoScopeWhere(conversations.employeeId,this.demoScope)));
  }

  async openTickets(): Promise<{ code: string; title: string; priority: Priority; status: TicketStatus; updatedAt: Date; ownerName: string }[]> {
    return this.db
      .select({ code: tickets.code, title: tickets.title, priority: tickets.priority, status: tickets.status, updatedAt: tickets.updatedAt, ownerName: employees.name })
      .from(tickets)
      .innerJoin(employees, eq(tickets.ownerId, employees.id))
      .where(and(ne(tickets.status, "resolved"),demoScopeWhere(tickets.ownerId,this.demoScope)));
  }

  async countAnalysts(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(employees).where(and(eq(employees.role, "analyst"),demoScopeWhere(employees.id,this.demoScope)));
    return row?.total ?? 0;
  }
}
