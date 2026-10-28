/**
 * Cada execução do funcionário simulado começa do mesmo estado (o seed), como no τ-bench.
 * Roda contra um SQLite em memória com as migrações do projeto; nunca chama o modelo.
 */
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@/infrastructure/db/client";
import { conversations, messages, tickets } from "@/infrastructure/db/schema";
import { seedDemoData } from "@/infrastructure/db/seed";
import { resetSimState } from "./reset";

let db: Database;

const codesOf = async (ownerId: string) => (await db.select({ code: tickets.code }).from(tickets).where(eq(tickets.ownerId, ownerId))).map((t) => t.code).sort();
const statusOf = async (code: string) => (await db.select({ status: tickets.status }).from(tickets).where(eq(tickets.code, code)))[0]?.status;

beforeEach(async () => {
  db = createDatabase("file::memory:", undefined);
  await migrate(db, { migrationsFolder: "drizzle" });
  await seedDemoData(db);
});

describe("resetSimState", () => {
  it("apaga o chamado que a execução anterior abriu, para a próxima não vê-lo como duplicado", async () => {
    const seeded = await codesOf("emp-ana");
    const now = new Date();
    await db.insert(tickets).values({
      code: "INC-29999",
      type: "INC",
      title: "VPN erro 809 no Windows 11",
      description: "aberto pela execução #1",
      category: "network",
      priority: "high",
      status: "open",
      impact: "me",
      ownerId: "emp-ana",
      createdAt: now,
      updatedAt: now,
    });

    await resetSimState(db);

    expect(await codesOf("emp-ana")).toEqual(seeded);
  });

  it("desfaz a alteração num chamado do seed (ex.: reaberto e atualizado pela execução anterior)", async () => {
    const [code] = await codesOf("emp-ana");
    const original = await statusOf(code);
    await db.update(tickets).set({ status: original === "resolved" ? "open" : "resolved" }).where(eq(tickets.code, code));

    await resetSimState(db);

    expect(await statusOf(code)).toBe(original);
  });

  it("descarta conversas e mensagens da execução anterior e mantém as do seed", async () => {
    const seededConversations = (await db.select({ id: conversations.id }).from(conversations)).length;
    await db.insert(conversations).values({ id: "conv-sim-1", employeeId: "emp-ana", status: "with_agent", createdAt: new Date(), updatedAt: new Date() });
    await db.insert(messages).values({ id: "msg-sim-1", conversationId: "conv-sim-1", role: "employee", text: "minha vpn nao conecta", cards: [], createdAt: new Date() });

    await resetSimState(db);

    expect((await db.select({ id: conversations.id }).from(conversations)).length).toBe(seededConversations);
    expect(await db.select().from(messages).where(eq(messages.conversationId, "conv-sim-1"))).toEqual([]);
  });
});
