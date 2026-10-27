import { DomainError } from "@/domain/errors";
import type { TurnContext } from "../turn-context";

export type ToolError = { error: string };

/**
 * Executa a lógica da tool e transforma erro de negócio em resposta legível
 * para o modelo (ex.: "chamado não encontrado"), em vez de derrubar o turno.
 */
export async function attempt<T>(turn: TurnContext, failureLabel: string, fn: () => Promise<T>): Promise<T | ToolError> {
  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    turn.recorder.step(failureLabel, error.message, false);
    return { error: error.message };
  }
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDateTime = (iso: string | Date) => timeFormat.format(new Date(iso));
