"use client";

import { useState } from "react";
import { TicketStatus } from "@/components/nexo/status-pill";
import type { TicketSnapshot } from "@/domain/message";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Lista para o funcionário escolher um chamado. A escolha vira a próxima mensagem. */
export function TicketChoiceCard({ tickets, onChoose }: { tickets: TicketSnapshot[]; onChoose?: (text: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const disabled = !onChoose || chosen !== null;

  return (
    <ul className="@container overflow-hidden rounded-2xl border bg-surface shadow-xs" role="radiogroup" aria-label="Escolha um chamado">
      {tickets.map((ticket) => (
        <li key={ticket.code} className="border-b last:border-b-0">
          <button
            type="button"
            role="radio"
            aria-checked={chosen === ticket.code}
            disabled={disabled}
            onClick={() => {
              setChosen(ticket.code);
              onChoose?.(`${ticket.code} · ${ticket.title}`);
            }}
            className={cn(
              // Lista estreita (celular, tablet): o estado desce para baixo do título, porque ao lado não cabe. Larga: fica à direita.
              "relative grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 px-4 py-3 text-left text-sm transition-colors duration-150 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset @lg:grid-cols-[auto_minmax(0,1fr)_auto] @lg:px-5",
              !disabled && "hover:bg-accent/50 active:bg-accent",
              chosen === ticket.code && "bg-accent/60",
              disabled && chosen !== ticket.code && "cursor-not-allowed text-muted-foreground",
            )}
          >
            <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border border-input bg-surface", chosen === ticket.code && "border-primary")}>
              {chosen === ticket.code && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[11px] tracking-tight text-muted-foreground">{ticket.code}</span>
              <span className="block font-medium @lg:truncate" title={ticket.title}>
                {ticket.title}
              </span>
            </span>
            <span className="col-start-2 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 @lg:col-start-3 @lg:mt-0 @lg:flex-col @lg:flex-nowrap @lg:items-end @lg:gap-0.5">
              <TicketStatus status={ticket.status} overdue={ticket.overdue} />
              <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">{formatDayMonth(ticket.updatedAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
