/**
 * O prazo do chamado atende a necessidade que o funcionário informou?
 * Decisão de produto: o agent só oferece um analista por causa de prazo quando o
 * SLA vence depois do compromisso (ex.: reunião às 15h e prazo para amanhã).
 * Horário de Brasília (UTC−3 fixo, como em business-time.ts).
 */
const HOUR_MS = 60 * 60 * 1000;
const BRASILIA_OFFSET_MS = -3 * HOUR_MS;
/** "DD/MM" sem hora vale até o fim do expediente. */
const END_OF_DAY_HOUR = 18;
/** Data que ficaria mais de ~6 meses no passado é do ano que vem (pedido em dezembro para 05/01). */
const PAST_TOLERANCE_MS = 180 * 24 * HOUR_MS;

/** Lê "HH:MM" (hoje), "DD/MM" ou "DD/MM HH:MM". Formato inválido → null. */
export function parseNeededBy(text: string, now: Date): Date | null {
  const match = text.trim().match(/^(?:(\d{1,2})\/(\d{1,2}))?\s*(?:(\d{1,2}):(\d{2}))?$/);
  if (!match || (!match[1] && !match[3])) return null;
  const local = new Date(now.getTime() + BRASILIA_OFFSET_MS);
  const month = match[2] ? Number(match[2]) - 1 : local.getUTCMonth();
  const day = match[1] ? Number(match[1]) : local.getUTCDate();
  const hour = match[3] ? Number(match[3]) : END_OF_DAY_HOUR;
  const minute = match[4] ? Number(match[4]) : 0;
  if (hour > 23 || minute > 59 || month > 11 || day < 1) return null;

  const build = (year: number) => {
    const candidate = new Date(Date.UTC(year, month, day, hour, minute) - BRASILIA_OFFSET_MS);
    const check = new Date(candidate.getTime() + BRASILIA_OFFSET_MS);
    return check.getUTCMonth() === month && check.getUTCDate() === day ? candidate : null;
  };
  const result = build(local.getUTCFullYear());
  if (result && match[1] && now.getTime() - result.getTime() > PAST_TOLERANCE_MS) return build(local.getUTCFullYear() + 1);
  return result;
}

/** Sem necessidade informada, o prazo padrão atende: não há motivo de prazo para chamar um analista. */
export function deadlineMeetsNeed(deadline: Date, neededBy: Date | null): boolean {
  return !neededBy || deadline.getTime() <= neededBy.getTime();
}
