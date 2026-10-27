import { TicketStatus } from "@/components/nexo/status-pill";
import type { TicketSnapshot } from "@/domain/message";
import { CATEGORY_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL } from "@/domain/ticket";
import { formatDayTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardShell, Field } from "./card-shell";

export function TicketCard({ ticket }: { ticket: TicketSnapshot }) {
  return (
    <CardShell
      eyebrow={`${TICKET_TYPE_LABEL[ticket.type]} · ${ticket.code}`}
      status={<TicketStatus status={ticket.status} overdue={ticket.overdue} />}
      title={ticket.title}
      description={ticket.description}
    >
      <Field label="Categoria">{CATEGORY_LABEL[ticket.category]}</Field>
      <Field label="Prioridade">{PRIORITY_LABEL[ticket.priority]}</Field>
      <Field label="Aberto em">{formatDayTime(ticket.createdAt)}</Field>
      <Field label="Última atualização">
        <span className={cn(ticket.overdue && "font-semibold text-danger")}>{formatRelative(ticket.updatedAt)}</span>
        {ticket.overdue && <span className="text-muted-foreground"> · prazo vencido</span>}
      </Field>
    </CardShell>
  );
}
