import type { TicketStatus } from "@/domain/ticket";
import { STATUS_LABEL } from "@/domain/ticket";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, { dot: string; text: string }> = {
  success: { dot: "bg-success", text: "text-success" },
  warning: { dot: "bg-warning", text: "text-amber-700" },
  danger: { dot: "bg-danger", text: "text-danger" },
  info: { dot: "bg-primary", text: "text-primary" },
  neutral: { dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
};

/** Texto com bolinha colorida: "● Aguardando analista". */
export function StatusDot({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", TONE[tone].text, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", TONE[tone].dot)} />
      {children}
    </span>
  );
}

/** Pílula de estado (cabeçalhos). */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const bg = { success: "bg-success-soft", warning: "bg-warning-soft", danger: "bg-danger-soft", info: "bg-info-soft", neutral: "bg-muted" }[tone];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1", bg)}>
      <StatusDot tone={tone}>{children}</StatusDot>
    </span>
  );
}

export const ticketTone = (status: TicketStatus, overdue = false): Tone => {
  if (overdue) return "danger";
  switch (status) {
    case "waiting_analyst":
    case "open":
      return "warning";
    case "in_progress":
      return "info";
    case "approved":
      return "success";
    case "resolved":
      return "neutral";
  }
};

export function TicketStatus({ status, overdue }: { status: TicketStatus; overdue?: boolean }) {
  return (
    <StatusDot tone={ticketTone(status, overdue)} className="whitespace-nowrap">
      {STATUS_LABEL[status]}
      {overdue && " · prazo vencido"}
    </StatusDot>
  );
}
