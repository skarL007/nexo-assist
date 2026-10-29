import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabase, type Database } from "./db/client";
import { employees, tickets, conversations } from "./db/schema";
import { employees as seedEmployees } from "./db/seed-data";
import { cleanupDemoWorkspaces, provisionDemoWorkspace } from "./demo-workspace";

const A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const now = new Date("2026-10-29T12:00:00.500Z");
let database: Database;

beforeEach(async () => {
  database = createDatabase("file::memory:", undefined);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(employees).values(seedEmployees());
});

describe("provisionamento da demo", () => {
  it("é idempotente e mantém chamados separados em dois espaços", async () => {
    await provisionDemoWorkspace(database, A, now);
    const first = await database.select().from(tickets);
    await provisionDemoWorkspace(database, A, now);
    expect(await database.select().from(tickets)).toEqual(first);
    await provisionDemoWorkspace(database, B, now);
    const all = await database.select().from(tickets);
    expect(all).toHaveLength(first.length * 2);
    expect(new Set(all.map(ticket => ticket.code)).size).toBe(all.length);
    expect(new Set(all.map(ticket => ticket.ownerId.split(":")[1]))).toEqual(new Set([A, B]));
    const ana = await database.query.employees.findFirst({ where: eq(employees.id, `demo:${A}:emp-ana`) });
    expect(ana?.passwordChangedAt.getTime()).toBeLessThanOrEqual(Math.floor(now.getTime() / 1000) * 1000);
  });

  it("limpa apenas espaços expirados, sem remover fixtures nem visitantes recentes", async () => {
    await provisionDemoWorkspace(database, A, new Date(now.getTime() - 8 * 86400_000));
    await provisionDemoWorkspace(database, B, now);
    await cleanupDemoWorkspaces(database, now);
    const people = await database.select().from(employees);
    expect(people.some(person => person.id.startsWith(`demo:${A}:`))).toBe(false);
    expect(people.some(person => person.id.startsWith(`demo:${B}:`))).toBe(true);
    expect(people.filter(person => !person.id.startsWith("demo:"))).toHaveLength(seedEmployees().length);
    expect((await database.select().from(conversations)).every(conversation => conversation.employeeId.startsWith(`demo:${B}:`))).toBe(true);
  });

  it("limita novos espaços sem impedir que visitantes existentes retornem", async () => {
    for (let index = 0; index < 20; index++) {
      await provisionDemoWorkspace(database, `${index.toString(16).padStart(8, "0")}-aaaa-4aaa-aaaa-aaaaaaaaaaaa`, now);
    }
    await expect(provisionDemoWorkspace(database, A, now)).rejects.toMatchObject({ code: "message_limit" });
    await expect(provisionDemoWorkspace(database, "00000000-aaaa-4aaa-aaaa-aaaaaaaaaaaa", now)).resolves.toBeUndefined();
  });
});
