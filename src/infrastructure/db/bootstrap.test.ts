/**
 * Preparo do banco na imagem Docker, contra um SQLite de verdade (em memória):
 * migra sempre, cria os dados de exemplo só no banco vazio e nunca apaga o que já existe.
 */
import { count } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { prepareDatabase } from "./bootstrap";
import { createDatabase, type Database } from "./client";
import { conversations, employees } from "./schema";

let db: Database;

beforeEach(() => {
  db = createDatabase("file::memory:", undefined);
});

const total = async (table: typeof employees | typeof conversations) => (await db.select({ n: count() }).from(table))[0]!.n;

describe("preparo do banco da imagem Docker", () => {
  it("banco vazio: aplica as migrações e cria os dados de exemplo", async () => {
    const result = await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: true });

    expect(result).toEqual({ seeded: true });
    expect(await total(employees)).toBeGreaterThan(0);
    expect(await total(conversations)).toBeGreaterThan(0);
  });

  it("segunda subida: não recria os dados e mantém o que mudou desde o primeiro start", async () => {
    await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: true });
    await db.insert(conversations).values({ id: "conv-depois-do-seed", employeeId: "emp-ana", status: "with_agent", createdAt: new Date(), updatedAt: new Date() });
    const before = await total(conversations);

    const result = await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: true });

    expect(result).toEqual({ seeded: false });
    expect(await total(conversations)).toBe(before);
  });

  it("com o seed desligado, só migra (as tabelas existem e ficam vazias)", async () => {
    const result = await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: false });

    expect(result).toEqual({ seeded: false });
    expect(await total(employees)).toBe(0);
  });
});
