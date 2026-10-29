import { and, desc, eq, ne } from "drizzle-orm";
import type { ConversationRepository } from "@/application/ports";
import type { Conversation } from "@/domain/conversation";
import type { Database } from "../db/client";
import { conversations } from "../db/schema";
import { demoScopeWhere } from "./demo-scope";

type Row = typeof conversations.$inferSelect;

// O banco guarda a transferência em colunas soltas; o domínio usa um objeto.
function toDomain(row: Row): Conversation {
  return {
    id: row.id,
    employeeId: row.employeeId,
    status: row.status,
    analystId: row.analystId,
    handoff:
      row.handoffReason && row.handoffAt
        ? {
            reason: row.handoffReason,
            summary: row.handoffSummary ?? "",
            ticketCode: row.handoffTicketCode,
            confidence: row.handoffConfidence === null ? null : row.handoffConfidence / 100,
            at: row.handoffAt,
          }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(c: Conversation): Row {
  return {
    id: c.id,
    employeeId: c.employeeId,
    status: c.status,
    analystId: c.analystId,
    handoffReason: c.handoff?.reason ?? null,
    handoffSummary: c.handoff?.summary ?? null,
    handoffTicketCode: c.handoff?.ticketCode ?? null,
    handoffConfidence: c.handoff?.confidence == null ? null : Math.round(c.handoff.confidence * 100),
    handoffAt: c.handoff?.at ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database, private readonly demoScope?: string) {}

  async findById(id: string): Promise<Conversation | null> {
    const row = await this.db.query.conversations.findFirst({ where: and(eq(conversations.id, id), demoScopeWhere(conversations.employeeId, this.demoScope)) });
    return row ? toDomain(row) : null;
  }

  async findLatestOpenByEmployee(employeeId: string): Promise<Conversation | null> {
    const row = await this.db.query.conversations.findFirst({
      where: and(eq(conversations.employeeId, employeeId), ne(conversations.status, "closed")),
      orderBy: desc(conversations.updatedAt),
    });
    return row ? toDomain(row) : null;
  }

  async listRecent(limit: number): Promise<Conversation[]> {
    const rows = await this.db.select().from(conversations).where(demoScopeWhere(conversations.employeeId, this.demoScope)).orderBy(desc(conversations.updatedAt)).limit(limit);
    return rows.map(toDomain);
  }

  async insert(conversation: Conversation): Promise<void> {
    await this.db.insert(conversations).values(toRow(conversation));
  }

  async update(conversation: Conversation, expectedStatus: Conversation["status"]): Promise<boolean> {
    const updated = await this.db
      .update(conversations)
      .set(toRow(conversation))
      .where(and(eq(conversations.id, conversation.id), eq(conversations.status, expectedStatus)))
      .returning({ id: conversations.id });
    return updated.length > 0;
  }
}
