/**
 * Contexto de cada turno que vai ao modelo como mensagem de sistema: quem está
 * logado, quando é e quais rascunhos esperam confirmação.
 *
 * A hora vai cheia ("16h"), sem minutos, de propósito: o briefing fica no começo
 * do prompt, e um texto que muda a cada minuto quebra o prefixo que os provedores
 * reaproveitam do cache entre um turno e outro (medido no benchmark de modelos).
 * Prazos e vencimentos não dependem disto: as tools calculam com o relógio real.
 */
import type { Employee } from "@/domain/employee";
import type { DraftSnapshot } from "@/domain/message";

const hourFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** "ter., 27/10, 16h" — data e hora cheia no horário de Brasília. */
export function formatHour(date: Date): string {
  return `${hourFormat.format(date)}h`;
}

export function turnBriefing(employee: Employee, now: Date, pendingDrafts: DraftSnapshot[]): string {
  const drafts = pendingDrafts.length
    ? pendingDrafts
        .map((d) => `D-${d.id} (${d.kind === "create" ? `novo chamado: "${d.fields.title}"` : `atualização do ${d.fields.ticketCode}`})`)
        .join("; ")
    : "nenhum";
  return [
    "Contexto deste turno:",
    `- Funcionário logado: ${employee.name} (${employee.email}), área ${employee.department}.`,
    `- Agora: ${formatHour(now)} (Brasília).`,
    `- Rascunhos aguardando confirmação: ${drafts}.`,
  ].join("\n");
}
