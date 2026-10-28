/**
 * Modelo reserva: se o principal falhar num passo (ex.: Gemini com 503 "alta demanda"),
 * o Mastra tenta de novo e depois faz o passo no reserva, e o turno segue nele.
 * Aqui ficam as partes testáveis: a cadeia de modelos, a leitura de cada passo e a nota do trace.
 */
export const DEFAULT_FALLBACK_MODEL = "google/gemini-3.5-flash-lite";

/** Com reserva, o principal tenta de novo só 1 vez (cada tentativa custa segundos ao funcionário). */
export function modelChain(primary: string, fallback: string | undefined, hasKey: (model: string) => boolean): { model: string; maxRetries: number }[] {
  const usable = fallback && fallback !== "off" && fallback !== primary && hasKey(fallback);
  return usable
    ? [
        { model: primary, maxRetries: 1 },
        { model: fallback, maxRetries: 2 },
      ]
    : [{ model: primary, maxRetries: 2 }];
}

export interface StepFinishPayload {
  stepResult?: { reason?: string };
  output?: { usage?: { inputTokens?: number; outputTokens?: number } };
  fallbackModelIndex?: number;
}

/**
 * O que importa no fim de cada passo. O uso vem daqui, passo a passo: o total do stream
 * perde inputTokens/outputTokens depois de uma nova tentativa (aparecia como 0 tokens).
 */
export function readStepFinish(payload: StepFinishPayload | undefined): {
  usage: { inputTokens: number; outputTokens: number } | null;
  fallbackIndex: number | null;
  retried: boolean;
} {
  const usage = payload?.output?.usage;
  const counted = usage && (usage.inputTokens || usage.outputTokens) ? { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 } : null;
  return {
    usage: counted,
    fallbackIndex: typeof payload?.fallbackModelIndex === "number" && payload.fallbackModelIndex > 0 ? payload.fallbackModelIndex : null,
    retried: payload?.stepResult?.reason === "retry",
  };
}

export function fallbackNote(primary: string, fallback: string): string {
  return `O modelo principal (${primary}) não respondeu; o turno seguiu no modelo reserva (${fallback}).`;
}
