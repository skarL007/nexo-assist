/**
 * Livro-caixa do gasto com LLM: cada chamada paga (agent, embeddings, avaliador, evals) registra o
 * custo, e antes de cada chamada nova o livro confere o teto do dia (UTC) e o teto total.
 *
 * Em micro-dólares inteiros (contadores do banco são inteiros). Confere antes e registra depois:
 * o teto pode ser passado em no máximo uma chamada, centavos no pior caso. O teto duro de verdade
 * fica no provedor (crédito pré-pago, sem recarga automática); este é o teto diário e o aviso.
 */
import { DomainError } from "@/domain/errors";
import { systemClock, type Clock } from "./ports";

export interface SpendStore {
  get(key: string): Promise<number>;
  add(key: string, micros: number): Promise<void>;
}

export interface SpendLimits {
  dailyUsd?: number;
  totalUsd?: number;
}

const MICROS = 1_000_000;
const TOTAL_KEY = "usd_micros";

export class SpendLedger {
  constructor(
    private readonly store: SpendStore,
    private readonly limits: SpendLimits,
    private readonly clock: Clock = systemClock,
  ) {}

  private dayKey() {
    return `${TOTAL_KEY}:${this.clock.now().toISOString().slice(0, 10)}`;
  }

  async spent(): Promise<{ todayUsd: number; totalUsd: number }> {
    const [today, total] = await Promise.all([this.store.get(this.dayKey()), this.store.get(TOTAL_KEY)]);
    return { todayUsd: today / MICROS, totalUsd: total / MICROS };
  }

  async assertCanSpend(): Promise<void> {
    const { dailyUsd, totalUsd } = this.limits;
    if (dailyUsd === undefined && totalUsd === undefined) return;
    const spent = await this.spent();
    if (totalUsd !== undefined && spent.totalUsd >= totalUsd) {
      throw new DomainError("spend_limit", `O teto total de gasto com IA (US$ ${totalUsd.toFixed(2)}) foi atingido. Fale com o service desk pelo ramal 4000.`);
    }
    if (dailyUsd !== undefined && spent.todayUsd >= dailyUsd) {
      throw new DomainError("spend_limit", `O teto de gasto com IA de hoje (US$ ${dailyUsd.toFixed(2)}) foi atingido. Fale com o service desk pelo ramal 4000.`);
    }
  }

  async record(usd: number): Promise<void> {
    if (!Number.isFinite(usd) || usd <= 0) return;
    const micros = Math.round(usd * MICROS);
    await Promise.all([this.store.add(this.dayKey(), micros), this.store.add(TOTAL_KEY, micros)]);
  }
}
