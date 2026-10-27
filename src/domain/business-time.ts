/**
 * Horário comercial do service desk: segunda a sexta, 08h–18h (Brasília).
 *
 * Trabalhamos em "horário local" deslocando o timestamp em -3h e usando os
 * métodos getUTC* — assim o cálculo não depende do fuso do servidor.
 * O Brasil não tem horário de verão desde 2019, então o deslocamento é fixo.
 */

const HOUR_MS = 60 * 60 * 1000;
const BRASILIA_OFFSET_MS = -3 * HOUR_MS;

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 18;
export const BUSINESS_HOURS_PER_DAY = CLOSE_HOUR - OPEN_HOUR;

const toLocal = (date: Date) => new Date(date.getTime() + BRASILIA_OFFSET_MS);
const fromLocal = (local: Date) => new Date(local.getTime() - BRASILIA_OFFSET_MS);

function atHour(local: Date, hour: number): Date {
  const d = new Date(local);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function nextDayAtOpening(local: Date): Date {
  const d = atHour(local, OPEN_HOUR);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const isWeekend = (local: Date) => local.getUTCDay() === 0 || local.getUTCDay() === 6;

/** Avança até o próximo instante dentro do expediente (ou fica onde está). */
function moveIntoBusinessTime(local: Date): Date {
  let cursor = local;
  for (;;) {
    if (isWeekend(cursor)) {
      cursor = nextDayAtOpening(cursor);
    } else if (cursor < atHour(cursor, OPEN_HOUR)) {
      return atHour(cursor, OPEN_HOUR);
    } else if (cursor >= atHour(cursor, CLOSE_HOUR)) {
      cursor = nextDayAtOpening(cursor);
    } else {
      return cursor;
    }
  }
}

/** Soma horas úteis a uma data. Ex.: sexta 17h + 4h úteis = segunda 11h. */
export function addBusinessHours(start: Date, hours: number): Date {
  let remainingMs = hours * HOUR_MS;
  let cursor = toLocal(start);

  for (;;) {
    cursor = moveIntoBusinessTime(cursor);
    const closing = atHour(cursor, CLOSE_HOUR);
    const availableMs = closing.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return fromLocal(new Date(cursor.getTime() + remainingMs));
    }
    remainingMs -= availableMs;
    cursor = closing;
  }
}

/** Soma dias úteis (cada dia útil = 10 horas de expediente). */
export function addBusinessDays(start: Date, days: number): Date {
  return addBusinessHours(start, days * BUSINESS_HOURS_PER_DAY);
}

export function addCalendarHours(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * HOUR_MS);
}
