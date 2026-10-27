import { sql } from "drizzle-orm";
import type { BudgetRepository } from "@/application/ports";
import type { Database } from "../db/client";
import { usageCounters } from "../db/schema";

export class DrizzleBudgetRepository implements BudgetRepository {
  constructor(private readonly db: Database) {}

  /**
   * Soma 1 ao contador só se ele ainda estiver abaixo do teto, num único comando
   * (upsert com WHERE). Dois pedidos ao mesmo tempo não conseguem passar do teto.
   * Devolve false quando o teto já foi atingido.
   */
  async reserve(key: string, limit: number): Promise<boolean> {
    if (limit <= 0) return false;
    const rows = await this.db
      .insert(usageCounters)
      .values({ key, value: 1 })
      .onConflictDoUpdate({
        target: usageCounters.key,
        set: { value: sql`${usageCounters.value} + 1` },
        setWhere: sql`${usageCounters.value} < ${limit}`,
      })
      .returning({ value: usageCounters.value });
    return rows.length > 0;
  }
}
