import { AlarmClock, ArrowLeftRight, ChevronDown } from "lucide-react";
import { TicketStatus, ticketTone } from "@/components/nexo/status-pill";
import type { SlaAlertView } from "@/contracts/chat";
import { firstName } from "@/domain/employee";
import type { TicketSnapshot } from "@/domain/message";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/domain/ticket";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { danger: "bg-danger", warning: "bg-warning", info: "bg-primary", success: "bg-success", neutral: "bg-muted-foreground/50" };

/** Painel lateral: chamados do funcionário, destacando o que motivou a transferência. */
export function TicketsPanel({
  employeeName,
  tickets,
  ticketCode,
  slaAlerts = [],
}: {
  employeeName: string;
  tickets: TicketSnapshot[] | null;
  ticketCode: string | null;
  slaAlerts?: SlaAlertView[];
}) {
  if (!tickets) {
    return (
      <aside className="hidden w-80 shrink-0 flex-col border-l bg-surface xl:flex">
        <header className="flex h-[72px] shrink-0 flex-col justify-center border-b px-5">
          <h2 className="truncate font-serif text-lg leading-tight font-semibold tracking-tight">Chamados de {firstName(employeeName)}</h2>
        </header>
        <p role="status" className="p-5 text-sm leading-relaxed text-muted-foreground">
          O sistema de chamados não respondeu agora. Tentando de novo em instantes…
        </p>
      </aside>
    );
  }
  const current = tickets.find((t) => t.code === ticketCode);
  const others = tickets.filter((t) => t.code !== ticketCode);
  const open = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l bg-surface xl:flex">
      <header className="flex h-[72px] shrink-0 flex-col justify-center gap-1 border-b px-5">
        <h2 className="truncate font-serif text-lg leading-tight font-semibold tracking-tight">Chamados de {firstName(employeeName)}</h2>
        <p className="text-xs leading-tight text-muted-foreground tabular-nums">
          {plural(open, "aberto", "abertos")} · {plural(tickets.length - open, "encerrado", "encerrados")}
        </p>
      </header>

      <div className="scrollbar-quiet flex-1 space-y-6 overflow-y-auto p-5">
        {slaAlerts.length > 0 && (
          <section aria-label="Prazos" className="space-y-2">
            <h3 className="eyebrow">Prazos</h3>
            {slaAlerts.map((alert) => (
              <details
                key={alert.code}
                className={cn(
                  "group rounded-xl p-3 text-xs",
                  alert.level === "overdue" ? "bg-danger-soft shadow-[0_0_0_1px_oklch(0.6_0.21_27/0.16)]" : "bg-warning-soft shadow-[0_0_0_1px_oklch(0.72_0.17_60/0.2)]",
                )}
              >
                <summary className="flex cursor-pointer items-start gap-2 rounded-lg text-sm leading-snug font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <AlarmClock className={cn("mt-0.5 size-4 shrink-0", alert.level === "overdue" ? "text-danger-foreground" : "text-warning-foreground")} />
                  <span className="min-w-0 flex-1">
                    {alert.headline}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{alert.title}</span>
                    <span className="mt-2 inline-flex h-6 items-center gap-1 rounded-full bg-beam-soft pr-1.5 pl-2 text-xs font-medium text-beam-foreground group-open:bg-beam group-open:text-[oklch(0.3_0.06_70)]">
                      por quê? <ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
                    </span>
                  </span>
                </summary>
                <ul className="mt-2.5 ml-6 list-disc space-y-1 pl-4 leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
                  {alert.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        )}
        {current && (
          <section className="space-y-2">
            <h3 className="eyebrow">Desta conversa</h3>
            <div className="space-y-2 rounded-xl bg-background p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span className="font-mono text-xs tracking-tight text-muted-foreground">{current.code}</span>
                <TicketStatus status={current.status} overdue={current.overdue} />
              </div>
              <p className="text-sm leading-snug font-semibold text-pretty">{current.title}</p>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_LABEL[current.category]} · prioridade {PRIORITY_LABEL[current.priority].toLowerCase()}
              </p>
              <p className="flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
                <ArrowLeftRight className="size-3.5" /> Transferido para um analista
              </p>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="eyebrow">{current ? "Outros chamados" : "Chamados"}</h3>
          {others.length === 0 && <p className="text-sm text-muted-foreground">{current ? "Nenhum outro chamado." : "Nenhum chamado."}</p>}
          {/* Só leitura: as linhas não abrem nada, então não têm seta nem realce de clique. */}
          <ul className="divide-y">
            {others.map((t) => (
              <li key={t.code} className="flex items-start gap-3 py-2.5 first:pt-0.5">
                <span className={cn("mt-[7px] size-2 shrink-0 rounded-full", DOT[ticketTone(t.status, t.overdue)])} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm leading-snug font-medium text-pretty" title={t.title}>
                    {t.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] tracking-tight">{t.code}</span> · {t.overdue ? "vencido" : STATUS_LABEL[t.status].toLowerCase()} · {formatDayMonth(t.updatedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
