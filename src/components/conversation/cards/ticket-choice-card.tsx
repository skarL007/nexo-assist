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
              "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors",
              !disabled && "hover:bg-accent/60",
              chosen === ticket.code && "bg-accent/60",
            )}
          >
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border",
                chosen === ticket.code && "border-primary",
              )}
            >
              {chosen === ticket.code && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{ticket.code}</span>
            <span className="min-w-0 flex-1 truncate font-medium" title={ticket.title}>
              {ticket.title}
            </span>
            <TicketStatus status={ticket.status} overdue={ticket.overdue} />
            <span className="w-14 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground">{formatDayMonth(ticket.updatedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
