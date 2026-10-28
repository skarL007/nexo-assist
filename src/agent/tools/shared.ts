import { DomainError } from "@/domain/errors";
import { deadlineMeetsNeed, parseNeededBy } from "@/domain/sla-need";
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

/** Descrição do parâmetro neededBy, igual em getTicket e draftNewTicket. */
export const NEEDED_BY_DESCRIPTION =
  "Até quando o funcionário disse que precisa disso resolvido (horário de Brasília): 'HH:MM' de hoje, 'DD/MM' ou 'DD/MM HH:MM'. " +
  "Ex.: reunião hoje às 15h → '15:00'. Omita se ele não disse.";

/**
 * Prazo do chamado × necessidade informada (decisão de produto): só oferece analista por prazo
 * quando o SLA vence depois do compromisso. Marca o turno e devolve a instrução para o modelo.
 */
export function judgeDeadline(turn: TurnContext, deadline: Date | null, neededBy: string | undefined): { deadlineMeetsNeed: boolean; instruction: string } | undefined {
  if (!deadline || !neededBy) return undefined;
  const need = parseNeededBy(neededBy, turn.startedAt);
  if (!need) return undefined;
  if (deadlineMeetsNeed(deadline, need)) {
    turn.recorder.deadlineCoversNeed = true;
    turn.recorder.step("comparou o prazo com a necessidade", `Prazo ${formatDateTime(deadline)} atende (precisa até ${formatDateTime(need)})`);
    return { deadlineMeetsNeed: true, instruction: "O prazo atende o que o funcionário precisa: diga isso. Não ofereça analista por causa de prazo." };
  }
  turn.recorder.offerAnalyst = true;
  turn.recorder.step("comparou o prazo com a necessidade", `Prazo ${formatDateTime(deadline)} vence depois de ${formatDateTime(need)}`);
  turn.recorder.guardrail(`O prazo do chamado (${formatDateTime(deadline)}) não atende a necessidade informada (${formatDateTime(need)}): o agent oferece um analista.`);
  return {
    deadlineMeetsNeed: false,
    instruction: "O prazo vence depois do que o funcionário precisa: explique em uma frase e diga que, se quiser, pode falar com um analista (o sistema já mostra o botão). Não transfira sem ele pedir.",
  };
}
