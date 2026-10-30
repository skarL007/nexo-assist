/**
 * Preparo do banco na imagem Docker, contra um SQLite de verdade (em memória):
 * migra sempre, cria os dados de exemplo só no banco vazio e nunca apaga o que já existe.
 */
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { prepareDatabase } from "./bootstrap";
import { createDatabase, type Database } from "./client";
import { articles, conversations, employees } from "./schema";
import { syncArticles } from "./seed";
import { articles as seedArticles } from "./seed-data";

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

  it("segunda subida: atualiza a central de ajuda (artigos novos e alterados) sem apagar conversas", async () => {
    await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: true });
    await db.delete(articles).where(eq(articles.id, "kb-pc-nao-liga")); // banco de uma versão sem o artigo
    await db.update(articles).set({ title: "título antigo", checks: [] }).where(eq(articles.id, "kb-tela-sem-imagem"));
    const conversationsBefore = await total(conversations);

    await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: true });

    const byId = new Map((await db.select().from(articles)).map((a) => [a.id, a]));
    expect(byId.size).toBe(seedArticles.length);
    expect(byId.get("kb-pc-nao-liga")?.checks.map((c) => c.id)).toContain("energia-cabo");
    expect(byId.get("kb-tela-sem-imagem")?.title).toBe("Tela preta ou sem imagem");
    expect(byId.get("kb-tela-sem-imagem")?.checks.length).toBeGreaterThan(0);
    expect(await total(conversations)).toBe(conversationsBefore);
  });

  it("syncArticles mantém artigo que não está no seed (não apaga nada)", async () => {
    await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: true });
    await db.insert(articles).values({ id: "kb-extra", title: "Extra", body: "Criado depois.", tags: ["extra"] });

    expect(await syncArticles(db)).toBe(seedArticles.length);
    expect((await db.select().from(articles)).map((a) => a.id)).toContain("kb-extra");
  });

  it("com o seed desligado, só migra (as tabelas existem e ficam vazias)", async () => {
    const result = await prepareDatabase(db, { migrationsFolder: "drizzle", seedIfEmpty: false });

    expect(result).toEqual({ seeded: false });
    expect(await total(employees)).toBe(0);
  });
});
