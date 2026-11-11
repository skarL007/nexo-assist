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
    <ul className="overflow-hidden rounded-xl border bg-surface shadow-xs" role="radiogroup" aria-label="Escolha um chamado">
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
              "relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 px-5 py-3 text-left text-sm transition-colors duration-150 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              !disabled && "hover:bg-accent/50",
              chosen === ticket.code && "bg-accent/50 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-beam",
              disabled && chosen !== ticket.code && "cursor-not-allowed opacity-60",
            )}
          >
            <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border border-input bg-surface", chosen === ticket.code && "border-primary")}>
              {chosen === ticket.code && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[11px] text-muted-foreground">{ticket.code}</span>
              <span className="block truncate font-medium" title={ticket.title}>
                {ticket.title}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <TicketStatus status={ticket.status} overdue={ticket.overdue} />
              <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">{formatDayMonth(ticket.updatedAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
