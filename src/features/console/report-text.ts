/**
 * O relatório da conversa em texto, para o analista colar no chamado (botão "Copiar").
 * As mesmas frases servem para o painel, então ficam aqui uma vez só.
 */
import { HANDOFF_REASON_LABEL, STATUS_LABEL } from "@/domain/conversation";
import type { ConversationReport, PendingItem } from "@/domain/conversation-report";
import { firstName } from "@/domain/employee";
import { PRIORITY_LABEL, STATUS_LABEL as TICKET_STATUS_LABEL } from "@/domain/ticket";
import { formatDayTime, percent } from "@/lib/format";

export function handoffLine(handoff: NonNullable<ConversationReport["handoff"]>): string {
  return [
    `Transferida em ${formatDayTime(handoff.at)}`,
    HANDOFF_REASON_LABEL[handoff.reason],
    handoff.confidence !== null ? `confiança ${percent(handoff.confidence)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ticketLine({ code, ticket }: ConversationReport["tickets"][number]): string {
  if (!ticket) return `${code} (sem dados do sistema de chamados agora)`;
  return [
    code,
    ticket.title,
    TICKET_STATUS_LABEL[ticket.status],
    `prioridade ${PRIORITY_LABEL[ticket.priority]}`,
    ticket.deadline ? `prazo ${formatDayTime(ticket.deadline)}${ticket.overdue ? " (vencido)" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function pendingLine(item: PendingItem, employeeName: string): string {
  switch (item.kind) {
    case "waiting_analyst":
      return `${firstName(employeeName)} espera um atendente${item.since ? ` desde ${formatDayTime(item.since)}` : ""}`;
    case "draft":
      return `Rascunho D-${item.draftId} sem confirmação: ${item.title}`;
    case "overdue":
      return `${item.code} com prazo vencido desde ${formatDayTime(item.deadline)}: ${item.title}`;
  }
}

export function countsLine(report: ConversationReport): string {
  const { employee, agent, analyst } = report.counts;
  const period = report.startedAt && report.lastAt ? `De ${formatDayTime(report.startedAt)} a ${formatDayTime(report.lastAt)} · ` : "";
  return `${period}${employee} do funcionário, ${agent} do agent, ${analyst} de analista · ${STATUS_LABEL[report.status]}`;
}

export function reportAsText(report: ConversationReport): string {
  const section = (title: string, lines: string[]) => (lines.length ? [``, `${title}:`, ...lines.map((l) => `- ${l}`)] : []);
  return [
    `Relatório da conversa · ${report.employee.name} (${report.employee.department})`,
    countsLine(report),
    ...(report.need ? [``, `Precisa: ${report.need}`] : []),
    ...(report.handoff ? [handoffLine(report.handoff)] : []),
    ...section("O agent já fez", report.actions),
    ...section("Artigos da central de ajuda", report.articles),
    ...section("Falhas", report.failures),
    ...section("Chamados citados", report.tickets.map(ticketLine)),
    ...section("Pendências", report.pending.map((item) => pendingLine(item, report.employee.name))),
    ...(report.lowestConfidence !== null ? [``, `Menor confiança do agent: ${percent(report.lowestConfidence)}`] : []),
  ].join("\n");
}
