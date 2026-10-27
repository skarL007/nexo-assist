import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/config/env";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(url = env().DATABASE_URL, authToken = env().DATABASE_AUTH_TOKEN) {
  return drizzle(createClient({ url, authToken }), { schema });
}

// Uma conexão por processo (o hot reload do Next recria módulos, por isso o globalThis).
const globalForDb = globalThis as unknown as { db?: Database };

export function db(): Database {
  globalForDb.db ??= createDatabase();
  return globalForDb.db;
}
