import { and, count, gte } from "drizzle-orm";
import { demoScopeWhere } from "./demo-scope";
import type { SuggestionRepository } from "@/application/ports";
import { SUGGESTION_OUTCOMES, type SuggestionOutcome } from "@/domain/reply-suggestion";
import type { Database } from "../db/client";
import { replySuggestions } from "../db/schema";

export class DrizzleSuggestionRepository implements SuggestionRepository {
  constructor(private readonly db: Database, private readonly demoScope?: string) {}

  async record(event: { conversationId: string; analystId: string; outcome: SuggestionOutcome; at: Date }): Promise<void> {
    await this.db.insert(replySuggestions).values({ conversationId: event.conversationId, analystId: event.analystId, outcome: event.outcome, createdAt: event.at });
  }

  async countsSince(since: Date): Promise<Record<SuggestionOutcome, number>> {
    const rows = await this.db
      .select({ outcome: replySuggestions.outcome, total: count() })
      .from(replySuggestions)
      .where(and(gte(replySuggestions.createdAt, since), demoScopeWhere(replySuggestions.analystId, this.demoScope)))
      .groupBy(replySuggestions.outcome);
    const counts = Object.fromEntries(SUGGESTION_OUTCOMES.map((o) => [o, 0])) as Record<SuggestionOutcome, number>;
    for (const row of rows) counts[row.outcome] = row.total;
    return counts;
  }
}
