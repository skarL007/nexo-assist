import { describe, expect, it } from "vitest";
import { reserveModelTurn } from "./model-budget";
import type { BudgetRepository } from "./ports";

class MemoryBudget implements BudgetRepository {
  counters = new Map<string, number>();
  async reserve(key: string, limit: number) {
    const value = this.counters.get(key) ?? 0;
    if (value >= limit) return false;
    this.counters.set(key, value + 1);
    return true;
  }
}

const day = new Date("2026-10-29T15:00:00Z");

describe("reserveModelTurn", () => {
  it("cada turno gasta uma vaga do dia e uma do total", async () => {
    const budget = new MemoryBudget();
    await reserveModelTurn(budget, { daily: 100, total: 1000 }, day);
    expect([...budget.counters.values()]).toEqual([1, 1]);
  });

  it("teto do dia atingido: avisa o limite de hoje e não gasta o total", async () => {
    const budget = new MemoryBudget();
    await reserveModelTurn(budget, { daily: 1, total: 1000 }, day);
    await expect(reserveModelTurn(budget, { daily: 1, total: 1000 }, day)).rejects.toMatchObject({ code: "daily_limit", message: expect.stringContaining("hoje") });
    expect(budget.counters.get("model_turns")).toBe(1);
  });

  it("o teto do dia recomeça no dia seguinte (UTC)", async () => {
    const budget = new MemoryBudget();
    await reserveModelTurn(budget, { daily: 1 }, day);
    await expect(reserveModelTurn(budget, { daily: 1 }, new Date("2026-10-30T00:00:01Z"))).resolves.toBeUndefined();
  });

  it("teto total atingido: avisa o limite da demonstração", async () => {
    const budget = new MemoryBudget();
    await reserveModelTurn(budget, { daily: 100, total: 1 }, day);
    await expect(reserveModelTurn(budget, { daily: 100, total: 1 }, day)).rejects.toMatchObject({ code: "daily_limit", message: expect.stringContaining("demonstração") });
  });
});
