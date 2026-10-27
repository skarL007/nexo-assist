import { asc, eq } from "drizzle-orm";
import type { Draft, DraftRepository } from "@/application/ports";
import type { DraftStatus } from "@/domain/message";
import type { Database } from "../db/client";
import { drafts } from "../db/schema";

export class DrizzleDraftRepository implements DraftRepository {
  constructor(private readonly db: Database) {}

  async insert(draft: Omit<Draft, "id">): Promise<Draft> {
    const [row] = await this.db.insert(drafts).values(draft).returning();
    return row!;
  }

  async findById(id: number): Promise<Draft | null> {
    return (await this.db.query.drafts.findFirst({ where: eq(drafts.id, id) })) ?? null;
  }

  async listByConversation(conversationId: string): Promise<Draft[]> {
    return this.db.select().from(drafts).where(eq(drafts.conversationId, conversationId)).orderBy(asc(drafts.id));
  }

  async setStatus(id: number, status: DraftStatus): Promise<void> {
    await this.db.update(drafts).set({ status }).where(eq(drafts.id, id));
  }
}
