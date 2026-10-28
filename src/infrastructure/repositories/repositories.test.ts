/**
 * Repositórios contra um SQLite de verdade (em memória, com as migrações do projeto).
 * Aqui ficam as garantias que só o banco dá: atomicidade e restrições.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTicket } from "@/application/test-doubles";
import { createDatabase, type Database } from "../db/client";
import { conversations, employees, messages } from "../db/schema";
import { DrizzleBudgetRepository } from "./budget-repository";
import { DrizzleChangeFeed } from "./change-feed";
import { DrizzleMessageRepository } from "./message-repository";
import { DrizzleTicketRepository } from "./ticket-repository";

let db: Database;

beforeEach(async () => {
  db = createDatabase("file::memory:", undefined);
  await migrate(db, { migrationsFolder: "drizzle" });
});

describe("teto total de respostas do modelo", () => {
  it("reserva até o teto e recusa a partir dele", async () => {
    const budget = new DrizzleBudgetRepository(db);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await budget.reserve("model_turns", 3));
    expect(results).toEqual([true, true, true, false]);
  });

  it("pedidos simultâneos não passam do teto (a reserva é atômica, antes de chamar o modelo)", async () => {
    // Achado da revisão de segurança: contar respostas salvas deixava vários pedidos paralelos passarem.
    const budget = new DrizzleBudgetRepository(db);
    const results = await Promise.all(Array.from({ length: 10 }, () => budget.reserve("model_turns", 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });
});

describe("número do chamado", () => {
  it("avisa 'conflict' quando dois chamados pegam o mesmo código (o serviço tenta o próximo)", async () => {
    const repo = new DrizzleTicketRepository(db);
    await db.insert(employees).values({
      id: "ana",
      name: "Ana Souza",
      email: "ana.souza@nexo.com.br",
      role: "employee",
      department: "Financeiro",
      passwordChangedAt: new Date(),
    });
    await repo.insert(makeTicket({ code: "INC-1" }));
    await expect(repo.insert(makeTicket({ code: "INC-1" }))).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("assinaturas do tempo real", () => {
  const person = (id: string) => ({ id, name: id, email: `${id}@nexo.com.br`, role: "employee" as const, department: "TI", passwordChangedAt: new Date() });
  const conversation = (id: string, employeeId: string, at: number) => ({ id, employeeId, status: "with_agent" as const, createdAt: new Date(at), updatedAt: new Date(at) });
  const message = (id: string, conversationId: string, at: number) => ({ id, conversationId, role: "analyst" as const, text: "oi", cards: [], createdAt: new Date(at) });

  it("muda com mensagem nova (mesmo no mesmo milissegundo) e com a conversa atualizada", async () => {
    const feed = new DrizzleChangeFeed(db);
    await db.insert(employees).values([person("ana"), person("bia")]);
    await db.insert(conversations).values([conversation("c-ana", "ana", 1000), conversation("c-bia", "bia", 1000)]);
    await db.insert(messages).values(message("m1", "c-ana", 2000));

    const console0 = await feed.consoleVersion();
    const ana0 = await feed.employeeVersion("ana");
    const bia0 = await feed.employeeVersion("bia");
    expect(await feed.consoleVersion()).toBe(console0); // estável sem mudança

    await db.insert(messages).values(message("m2", "c-ana", 2000));
    expect(await feed.consoleVersion()).not.toBe(console0);
    expect(await feed.employeeVersion("ana")).not.toBe(ana0);
    expect(await feed.employeeVersion("bia")).toBe(bia0); // a conversa de outra pessoa não acorda a Bia

    const ana1 = await feed.employeeVersion("ana");
    await db.update(conversations).set({ status: "with_analyst", updatedAt: new Date(3000) });
    expect(await feed.employeeVersion("ana")).not.toBe(ana1);
    expect(await feed.employeeVersion("ninguem")).toBe("none");
  });
});

describe("frustração na fila do console", () => {
  it("vale o último entendimento do agent; sem frustração, a conversa não aparece no mapa", async () => {
    const repo = new DrizzleMessageRepository(db);
    await db.insert(employees).values({ id: "ana", name: "Ana", email: "ana@nexo.com.br", role: "employee", department: "TI", passwordChangedAt: new Date() });
    await db.insert(conversations).values([
      { id: "c1", employeeId: "ana", status: "with_agent", createdAt: new Date(1), updatedAt: new Date(1) },
      { id: "c2", employeeId: "ana", status: "closed", createdAt: new Date(1), updatedAt: new Date(1) },
    ]);
    const decision = (frustration: string, frustrationReason?: string) => ({
      decision: { intent: "question", understanding: "", confidence: 0.9, reasoning: "", frustration, frustrationReason },
      steps: [],
      toolCalls: [],
      guardrails: [],
      model: null,
      usage: null,
      latencyMs: 1,
    });
    const agent = (id: string, conversationId: string, trace: object, at: number) => ({ id, conversationId, role: "agent" as const, text: "…", cards: [], trace: trace as never, createdAt: new Date(at) });
    await db.insert(messages).values([agent("m1", "c1", decision("none"), 1), agent("m2", "c1", decision("high", "terceira vez"), 2), agent("m3", "c2", decision("high"), 1), agent("m4", "c2", decision("none"), 2)]);
    expect(Object.fromEntries(await repo.lastFrustrations(["c1", "c2"]))).toEqual({ c1: { level: "high", reason: "terceira vez" } });
  });
});
