/**
 * Tetos de custo do modelo. Cada turno que vai chamar o modelo reserva uma vaga no contador
 * do dia (UTC) e, se houver, no contador total. Mensagem que não chama o modelo não gasta:
 * a de exemplo criada no espaço de cada visitante da demo e a conversa com o analista.
 */
import { DomainError } from "@/domain/errors";
import type { BudgetRepository } from "./ports";

export async function reserveModelTurn(budget: BudgetRepository, limits: { daily: number; total?: number }, now: Date): Promise<void> {
  if (!(await budget.reserve(`model_turns:${now.toISOString().slice(0, 10)}`, limits.daily))) {
    throw new DomainError("daily_limit", "O Nexo Assist atingiu o limite de uso de hoje. Fale com o service desk pelo ramal 4000.");
  }
  if (limits.total !== undefined && !(await budget.reserve("model_turns", limits.total))) {
    throw new DomainError("daily_limit", "O Nexo Assist atingiu o limite de uso desta demonstração. Fale com o service desk pelo ramal 4000.");
  }
}
