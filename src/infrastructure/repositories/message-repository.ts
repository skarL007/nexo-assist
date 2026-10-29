import type { FrustrationSignal } from "@/domain/frustration";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { MessageRepository, NewMessage } from "@/application/ports";
import type { ChatMessage, MessageRole } from "@/domain/message";
import type { Database } from "../db/client";
import { conversations, messages } from "../db/schema";

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

  async findById(id: string): Promise<ChatMessage | null> {
    const row = await this.db.query.messages.findFirst({ where: eq(messages.id, id) });
    return row ? toDomain(row) : null;
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
    if (conversationIds.length === 0) return new Map();
    // A última de cada conversa = maior rowid (ordem de inserção). Sem o trace, que é grande.
    const lastRowIds = this.db
      .select({ rowid: sql<number>`max(rowid)` })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .groupBy(messages.conversationId);
    const rows = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        authorName: messages.authorName,
        text: messages.text,
        cards: messages.cards,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(sql`rowid`, lastRowIds));
    return new Map(rows.map((row) => [row.conversationId, toDomain({ ...row, trace: null })]));
  }

  async lastFrustrations(conversationIds: string[]): Promise<Map<string, FrustrationSignal>> {
    if (conversationIds.length === 0) return new Map();
    // Último entendimento de cada conversa: no SQLite, as colunas soltas com max() vêm da linha do máximo.
    const rows = await this.db
      .select({
        conversationId: messages.conversationId,
        level: sql<string | null>`json_extract(${messages.trace}, '$.decision.frustration')`,
        reason: sql<string | null>`json_extract(${messages.trace}, '$.decision.frustrationReason')`,
        last: sql<number>`max(rowid)`,
      })
      .from(messages)
      .where(and(inArray(messages.conversationId, conversationIds), eq(messages.role, "agent"), sql`json_extract(${messages.trace}, '$.decision') is not null`))
      .groupBy(messages.conversationId);
    return new Map(
      rows.flatMap((row) => (row.level === "some" || row.level === "high" ? [[row.conversationId, { level: row.level, reason: row.reason }] as const] : [])),
    );
  }

  async countByRole(conversationId: string, role: MessageRole): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.role, role)));
    return row?.total ?? 0;
  }

  async countByEmployeeSince(employeeId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.employeeId, employeeId), eq(messages.role, "employee"), gte(messages.createdAt, since)));
    return row?.total ?? 0;
  }
}
