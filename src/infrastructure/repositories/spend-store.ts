/**
 * Onde o livro-caixa do gasto com LLM guarda os micro-dólares.
 * - Banco (produção): os mesmos contadores `usage_counters` dos tetos de turnos.
 * - Arquivo (evals locais): cada eval recria o próprio banco, então o gasto acumulado entre
 *   execuções e dias fica num JSON fora dele (SPEND_LEDGER_FILE).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import type { SpendStore } from "@/application/spend-ledger";
import type { Database } from "../db/client";
import { usageCounters } from "../db/schema";

export class DrizzleSpendStore implements SpendStore {
  constructor(private readonly db: Database) {}

  async get(key: string): Promise<number> {
    const row = await this.db.query.usageCounters.findFirst({ where: eq(usageCounters.key, key) });
    return row?.value ?? 0;
  }

  async add(key: string, micros: number): Promise<void> {
    await this.db
      .insert(usageCounters)
      .values({ key, value: micros })
      .onConflictDoUpdate({ target: usageCounters.key, set: { value: sql`${usageCounters.value} + ${micros}` } });
  }
}

/** Leitura e escrita síncronas: dois awaits do mesmo processo não intercalam um ler-somar-gravar. */
export class FileSpendStore implements SpendStore {
  constructor(private readonly path: string) {}

  private read(): Record<string, number> {
    return existsSync(this.path) ? (JSON.parse(readFileSync(this.path, "utf8")) as Record<string, number>) : {};
  }

  async get(key: string): Promise<number> {
    return this.read()[key] ?? 0;
  }

  async add(key: string, micros: number): Promise<void> {
    const data = this.read();
    data[key] = (data[key] ?? 0) + micros;
    writeFileSync(this.path, JSON.stringify(data, null, 2));
  }
}
