import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { TicketStatus, ticketTone } from "@/components/nexo/status-pill";
import { firstName } from "@/domain/employee";
import type { TicketSnapshot } from "@/domain/message";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/domain/ticket";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { danger: "bg-danger", warning: "bg-warning", info: "bg-primary", success: "bg-success", neutral: "bg-muted-foreground/50" };

/** Painel lateral: chamados do funcionário, destacando o que motivou a transferência. */
export function TicketsPanel({ employeeName, tickets, ticketCode }: { employeeName: string; tickets: TicketSnapshot[]; ticketCode: string | null }) {
  const current = tickets.find((t) => t.code === ticketCode);
  const others = tickets.filter((t) => t.code !== ticketCode);
  const open = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l bg-surface xl:flex">
      <header className="border-b px-5 py-4">
        <h2 className="font-semibold">Chamados de {firstName(employeeName)}</h2>
        <p className="text-xs text-muted-foreground">
          {open} abertos · {tickets.length - open} encerrados
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {current && (
          <section className="space-y-2">
            <h3 className="text-xs text-muted-foreground">Desta conversa</h3>
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {current.code}
                <TicketStatus status={current.status} overdue={current.overdue} />
              </div>
              <p className="text-sm font-semibold">{current.title}</p>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_LABEL[current.category]} · prioridade {PRIORITY_LABEL[current.priority].toLowerCase()}
                {current.overdue && <span className="font-medium text-danger"> · prazo vencido</span>}
              </p>
              <p className="flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
                <ArrowLeftRight className="size-3.5" /> Transferido para um analista
              </p>
            </div>
          </section>
        )}

        <section className="space-y-1">
          <h3 className="text-xs text-muted-foreground">{current ? "Outros chamados" : "Chamados"}</h3>
          {others.length === 0 && <p className="text-sm text-muted-foreground">Nenhum chamado.</p>}
          <ul>
            {others.map((t) => (
              <li key={t.code} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/60">
                <span className={cn("size-2 shrink-0 rounded-full", DOT[ticketTone(t.status, t.overdue)])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.code} · {t.overdue ? "vencido" : STATUS_LABEL[t.status].toLowerCase()} · {formatDayMonth(t.updatedAt)}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
