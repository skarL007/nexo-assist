import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { MessageRepository, NewMessage } from "@/application/ports";
import type { ChatMessage, MessageRole } from "@/domain/message";
import type { Database } from "../db/client";
import { messages } from "../db/schema";

type Row = typeof messages.$inferSelect;

// Mensagens gravadas no mesmo milissegundo saem na ordem de inserção (rowid).
const oldestFirst = [asc(messages.createdAt), sql`rowid`] as const;
const newestFirst = [desc(messages.createdAt), sql`rowid desc`] as const;

const toDomain = (row: Row): ChatMessage => ({ ...row, createdAt: row.createdAt.toISOString() });

export class DrizzleMessageRepository implements MessageRepository {
  constructor(private readonly db: Database) {}

  async add(message: NewMessage): Promise<ChatMessage> {
    const row: Row = {
      id: randomUUID(),
      conversationId: message.conversationId,
      role: message.role,
      authorName: message.authorName ?? null,
      text: message.text,
      cards: message.cards ?? [],
      trace: message.trace ?? null,
      createdAt: new Date(),
    };
    await this.db.insert(messages).values(row);
    return toDomain(row);
  }

  async listByConversation(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(...oldestFirst);
    return rows.map(toDomain);
  }

  async listRecent(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(...newestFirst)
      .limit(limit);
    return rows.reverse().map(toDomain);
  }

  async lastByConversations(conversationIds: string[]): Promise<Map<string, ChatMessage>> {
    const result = new Map<string, ChatMessage>();
    if (conversationIds.length === 0) return result;
    const rows = await this.db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(...oldestFirst);
    for (const row of rows) result.set(row.conversationId, toDomain(row)); // o último sobrescreve
    return result;
  }

  async countByRole(conversationId: string, role: MessageRole): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.role, role)));
    return row?.total ?? 0;
  }

  async countByRoleSince(role: MessageRole, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(messages)
      .where(and(eq(messages.role, role), gte(messages.createdAt, since)));
    return row?.total ?? 0;
  }
}
