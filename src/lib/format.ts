/** Formatação de datas em português, sempre no horário de Brasília. */
const TZ = "America/Sao_Paulo";

const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "short" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "10:05" */
export const formatClock = (iso: string) => clock.format(new Date(iso));

/** "16 out" */
export const formatDayMonth = (iso: string) => dayMonth.format(new Date(iso)).replace(".", "");

/** "16 out, 14:20" */
export const formatDayTime = (iso: string) => `${formatDayMonth(iso)}, ${formatClock(iso)}`;

/** "há 5 dias", "há 3 horas", "agora" */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(diffMinutes) < 1) return "agora";
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relative.format(diffHours, "hour");
  return relative.format(Math.round(diffHours / 24), "day");
}

/** Hora se for hoje; "ontem"; senão a data curta. Usado na lista do console. */
export function formatListTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameDay = (a: Date, b: Date) => dayMonth.format(a) === dayMonth.format(b);
  if (sameDay(date, now)) return formatClock(iso);
  if (sameDay(date, new Date(now.getTime() - 86_400_000))) return "ontem";
  return formatDayMonth(iso);
}

export const percent = (value: number) => `${Math.round(value * 100)}%`;
