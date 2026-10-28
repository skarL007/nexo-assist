import { eq, inArray } from "drizzle-orm";
import type { FeedbackRepository } from "@/application/ports";
import type { Database } from "../db/client";
import { messageFeedback, messages } from "../db/schema";

export class DrizzleFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: Database) {}

  async upsert(feedback: { messageId: string; employeeId: string; helpful: boolean; at: Date }): Promise<void> {
    await this.db
      .insert(messageFeedback)
      .values({ messageId: feedback.messageId, employeeId: feedback.employeeId, helpful: feedback.helpful, createdAt: feedback.at })
      .onConflictDoUpdate({ target: messageFeedback.messageId, set: { helpful: feedback.helpful, createdAt: feedback.at } });
  }

  async byConversation(conversationId: string): Promise<Record<string, boolean>> {
    const ids = this.db.select({ id: messages.id }).from(messages).where(eq(messages.conversationId, conversationId));
    const rows = await this.db.select().from(messageFeedback).where(inArray(messageFeedback.messageId, ids));
    return Object.fromEntries(rows.map((r) => [r.messageId, r.helpful]));
  }
}
