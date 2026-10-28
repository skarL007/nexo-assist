/** Frases do alerta de prazo: as mesmas no chat do funcionário e no console do analista. */
import { BUSINESS_HOURS_PER_DAY, CLOSE_HOUR, OPEN_HOUR } from "@/domain/business-time";
import { SLA_LABEL } from "@/domain/priority";
import type { SlaRisk } from "@/domain/sla-risk";
import { PRIORITY_LABEL } from "@/domain/ticket";
import { formatDayTime } from "./format";

const HOUR = 3_600_000;
const num = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "45 min úteis", "4,5 h úteis", "2,5 dias úteis" (dia útil = expediente de 10 h). */
export function formatBusinessDuration(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} min úteis`;
  const hours = ms / HOUR;
  if (hours < BUSINESS_HOURS_PER_DAY) return `${num(hours)} h úteis`;
  const days = Math.round((hours / BUSINESS_HOURS_PER_DAY) * 10) / 10;
  return days === 1 ? "1 dia útil" : `${num(days)} dias úteis`;
}

export interface SlaExplanation {
  headline: string;
  lines: string[];
}

export function explainSla(risk: SlaRisk): SlaExplanation {
  const critical = risk.priority === "critical";
  const duration = (ms: number) => (critical ? `${Math.max(1, Math.round(ms / 60_000))} min` : formatBusinessDuration(ms));
  const headline = risk.level === "overdue" ? `${risk.code} venceu o prazo há ${duration(risk.overdueMs)}` : `${risk.code} vence em ${duration(risk.remainingMs)}`;

  const lines = [
    `Prioridade ${PRIORITY_LABEL[risk.priority]}: resposta em até ${SLA_LABEL[risk.priority]}${critical ? " (plantão 24 h)" : ""}, a contar da última atualização (${formatDayTime(risk.from.toISOString())}).`,
    `Prazo: ${formatDayTime(risk.deadline.toISOString())}${critical ? "" : ` (expediente de seg. a sex., ${OPEN_HOUR}h às ${CLOSE_HOUR}h)`}.`,
    risk.level === "overdue"
      ? `Atrasado há ${duration(risk.overdueMs)}.`
      : `Já passou ${Math.round(risk.usedFraction * 100)}% do prazo; faltam ${duration(risk.remainingMs)}.`,
  ];
  if (risk.pausedMs >= HOUR) lines.push(`O relógio ficou parado ${Math.round(risk.pausedMs / HOUR)} h fora do expediente (noites e fim de semana).`);
  return { headline, lines };
}
