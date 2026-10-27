/**
 * Repositórios contra um SQLite de verdade (em memória, com as migrações do projeto).
 * Aqui ficam as garantias que só o banco dá: atomicidade e restrições.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTicket } from "@/application/test-doubles";
import { createDatabase, type Database } from "../db/client";
import { employees } from "../db/schema";
import { DrizzleBudgetRepository } from "./budget-repository";
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
