import { count, eq, gte } from "drizzle-orm";
import type { InsightsSource } from "@/application/ports";
import type { ChatMessage, DraftStatus } from "@/domain/message";
import type { Database } from "../db/client";
import { drafts, employees, messageFeedback, messages } from "../db/schema";

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

  async countAnalysts(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(employees).where(eq(employees.role, "analyst"));
    return row?.total ?? 0;
  }
}
