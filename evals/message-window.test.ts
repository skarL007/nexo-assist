/**
 * Janela de mensagens limpa antes de cada cenário do eval.
 * Roda contra um SQLite em memória com as migrações do projeto; nunca chama o modelo.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { EMPLOYEE_MESSAGES_PER_DAY, EMPLOYEE_MESSAGES_PER_HOUR } from "@/domain/conversation";
import { createDatabase, type Database } from "@/infrastructure/db/client";
import { conversations, employees, messages } from "@/infrastructure/db/schema";
import { DrizzleMessageRepository } from "@/infrastructure/repositories/message-repository";
import { freeMessageWindow } from "./message-window";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let db: Database;
let repo: DrizzleMessageRepository;

const person = (id: string) => ({ id, name: id, email: `${id}@nexo.com.br`, role: "employee" as const, department: "TI", passwordChangedAt: new Date() });

async function conversation(id: string, employeeId: string, status: "with_agent" | "closed" = "closed") {
  await db.insert(conversations).values({ id, employeeId, status, createdAt: new Date(), updatedAt: new Date() });
}

/** `count` mensagens do funcionário, uma por minuto, a partir de `startMinutesAgo` para trás. */
async function employeeMessages(conversationId: string, prefix: string, count: number, startMinutesAgo: number) {
  await db.insert(messages).values(
    Array.from({ length: count }, (_, i) => ({
      id: `${prefix}-${i}`,
      conversationId,
      role: "employee" as const,
      text: `mensagem ${i}`,
      cards: [],
      createdAt: new Date(Date.now() - (startMinutesAgo - i) * MINUTE),
    })),
  );
}

const sinceHour = () => new Date(Date.now() - HOUR);
const sinceDay = () => new Date(Date.now() - DAY);

beforeEach(async () => {
  db = createDatabase("file::memory:", undefined);
  await migrate(db, { migrationsFolder: "drizzle" });
  repo = new DrizzleMessageRepository(db);
  await db.insert(employees).values([person("ana"), person("bruno")]);
});

describe("janela de mensagens do eval", () => {
  it("quem estourou 40/h e 120/dia volta a contar 0 nas duas janelas", async () => {
    await conversation("c-antiga", "ana");
    await conversation("c-aberta", "ana", "with_agent");
    await employeeMessages("c-antiga", "a", 100, 50); // dentro da última hora e do dia
    await employeeMessages("c-aberta", "b", 30, 30);

    // Estado que reproduz o log do eval: o agent recusaria a próxima mensagem.
    expect(await repo.countByEmployeeSince("ana", sinceHour())).toBeGreaterThanOrEqual(EMPLOYEE_MESSAGES_PER_HOUR);
    expect(await repo.countByEmployeeSince("ana", sinceDay())).toBeGreaterThanOrEqual(EMPLOYEE_MESSAGES_PER_DAY);

    const moved = await freeMessageWindow(db, "ana");

    expect(await repo.countByEmployeeSince("ana", sinceHour())).toBe(0);
    expect(await repo.countByEmployeeSince("ana", sinceDay())).toBe(0);
    expect(moved).toBe(130);
  });

  it("não mexe nas mensagens de outra pessoa nem apaga nada", async () => {
    await conversation("c-ana", "ana");
    await conversation("c-bruno", "bruno");
    await employeeMessages("c-ana", "a", 10, 20);
    await employeeMessages("c-bruno", "b", 7, 20);

    await freeMessageWindow(db, "ana");

    expect(await repo.countByEmployeeSince("bruno", sinceHour())).toBe(7);
    expect(await db.$count(messages)).toBe(17);
  });

  it("mantém a ordem das mensagens da conversa e deixa as já antigas como estavam", async () => {
    await conversation("c-ana", "ana");
    await employeeMessages("c-ana", "recente", 5, 10);
    const oldAt = new Date(Date.now() - 3 * DAY);
    await db.insert(messages).values({ id: "velha", conversationId: "c-ana", role: "employee", text: "de anteontem", cards: [], createdAt: oldAt });
    const before = (await repo.listByConversation("c-ana")).map((m) => m.id);

    await freeMessageWindow(db, "ana");

    expect((await repo.listByConversation("c-ana")).map((m) => m.id)).toEqual(before);
    expect((await repo.findById("velha"))?.createdAt).toBe(oldAt.toISOString());
  });

  it("chamar de novo não move nada (as mensagens já saíram da janela)", async () => {
    await conversation("c-ana", "ana");
    await employeeMessages("c-ana", "a", 5, 10);
    expect(await freeMessageWindow(db, "ana")).toBe(5);
    expect(await freeMessageWindow(db, "ana")).toBe(0);
  });
});
