/**
 * Preparo do banco quando o contêiner Docker sobe (scripts/docker-init.ts):
 * aplica as migrações sempre e cria os dados de exemplo só no banco vazio,
 * para um restart nunca apagar o que foi feito desde o primeiro start. No banco
 * que já existia, atualiza só a central de ajuda (syncArticles).
 */
import { count } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Database } from "./client";
import { employees } from "./schema";
import { seedDemoData, syncArticles } from "./seed";

export interface PrepareOptions {
  /** Pasta das migrações geradas pelo drizzle-kit. */
  migrationsFolder: string;
  /** false = nunca cria os dados de exemplo (SEED_IF_EMPTY=0). */
  seedIfEmpty: boolean;
}

export async function prepareDatabase(db: Database, options: PrepareOptions): Promise<{ seeded: boolean }> {
  await migrate(db, { migrationsFolder: options.migrationsFolder });
  if (!options.seedIfEmpty) return { seeded: false };

  const [{ people }] = await db.select({ people: count() }).from(employees);
  if (people > 0) {
    // Banco que já existia: só a central acompanha a versão nova (artigos novos ou alterados).
    await syncArticles(db);
    return { seeded: false };
  }

  await seedDemoData(db);
  return { seeded: true };
}
