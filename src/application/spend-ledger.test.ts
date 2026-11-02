import { describe, expect, it } from "vitest";
import { SpendLedger, type SpendStore } from "./spend-ledger";
import { fixedClock } from "./test-doubles";

class MemoryStore implements SpendStore {
  values = new Map<string, number>();
  async get(key: string) {
    return this.values.get(key) ?? 0;
  }
  async add(key: string, micros: number) {
    this.values.set(key, (this.values.get(key) ?? 0) + micros);
  }
}

const day = fixedClock("2026-11-02T15:00:00Z");

describe("livro-caixa do gasto com LLM (teto diário e total)", () => {
  it("soma o gasto no dia (UTC) e no total, em micro-dólares", async () => {
    const store = new MemoryStore();
    const ledger = new SpendLedger(store, { dailyUsd: 0.5, totalUsd: 3 }, day);
    await ledger.record(0.0123);
    await ledger.record(0.0001);
    expect(store.values.get("usd_micros:2026-11-02")).toBe(12_400);
    expect(store.values.get("usd_micros")).toBe(12_400);
    expect(await ledger.spent()).toEqual({ todayUsd: 0.0124, totalUsd: 0.0124 });
  });

  it("recusa a próxima chamada quando o dia chegou ao teto, com a mensagem do dia", async () => {
    const ledger = new SpendLedger(new MemoryStore(), { dailyUsd: 0.5, totalUsd: 3 }, day);
    await ledger.record(0.5);
    await expect(ledger.assertCanSpend()).rejects.toMatchObject({ code: "spend_limit", message: expect.stringContaining("hoje") });
  });

  it("o teto diário recomeça no dia seguinte, mas o total continua valendo", async () => {
    const store = new MemoryStore();
    await new SpendLedger(store, { dailyUsd: 0.5, totalUsd: 0.6 }, day).record(0.5);
    const tomorrow = new SpendLedger(store, { dailyUsd: 0.5, totalUsd: 0.6 }, fixedClock("2026-11-03T00:00:01Z"));
    await expect(tomorrow.assertCanSpend()).resolves.toBeUndefined();
    await tomorrow.record(0.1);
    await expect(tomorrow.assertCanSpend()).rejects.toMatchObject({ code: "spend_limit", message: expect.stringContaining("total") });
  });

  it("sem tetos configurados, só registra", async () => {
    const ledger = new SpendLedger(new MemoryStore(), {}, day);
    await ledger.record(100);
    await expect(ledger.assertCanSpend()).resolves.toBeUndefined();
  });

  it("custo inválido (negativo, NaN) não entra no livro", async () => {
    const store = new MemoryStore();
    const ledger = new SpendLedger(store, { totalUsd: 3 }, day);
    await ledger.record(-1);
    await ledger.record(Number.NaN);
    expect(store.values.size).toBe(0);
  });
});
