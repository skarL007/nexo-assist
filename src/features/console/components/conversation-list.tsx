"use client";

import { Bot, Inbox, Search, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { StatusDot, StatusPill } from "@/components/nexo/status-pill";
import type { ConsoleConversationSummary, KnownIssueView } from "@/contracts/chat";
import { formatClock, formatListTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FILTERS, matchesFilter, matchesSearch, sortForConsole, statusLine, type FilterId } from "../conversation-filters";

interface Props {
  /** Stream aberto (tempo real) ou polling. */
  live: boolean;
  /** Possíveis incidentes em massa agora (vários funcionários, mesmo problema). */
  knownIssues: KnownIssueView[];
  conversations: ConsoleConversationSummary[];
  analystId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

const EMPTY: Record<FilterId, string> = {
  all: "Nenhuma conversa ainda.",
  queue: "Ninguém esperando atendimento.",
  agent: "Nenhuma conversa com o agent agora.",
  mine: "Você não assumiu nenhuma conversa.",
};

export function ConversationList({ live, knownIssues, conversations, analystId, selectedId, onSelect, className }: Props) {
  const [filter, setFilter] = useState<FilterId>("queue");
  const [query, setQuery] = useState("");

  const visible = sortForConsole(conversations.filter((c) => matchesFilter(c, filter, analystId) && matchesSearch(c, query)));

  return (
    <section className={cn("flex w-full shrink-0 flex-col border-r bg-surface lg:w-[21rem]", className)} aria-label="Conversas">
      <div className="space-y-3 border-b px-4 pt-4 pb-3">
        <div className="flex h-10 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-[22px] leading-tight font-semibold tracking-tight">Conversas</h1>
            <p className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground" data-testid="live-indicator">
              <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
              {live ? "Ao vivo" : "Atualiza a cada 4 s"}
            </p>
          </div>
          <StatusPill tone="success">Disponível</StatusPill>
        </div>

        {knownIssues.map((issue) => (
          <p
            key={`${issue.category}-${issue.terms.join()}`}
            role="status"
            className="flex gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning-foreground shadow-[0_0_0_1px_oklch(0.72_0.17_60/0.2)]"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold">Possível incidente em massa</span>
              {/* Uma linha só de texto: os testes e os leitores de tela leem "Software · ponto · 3 relatos…". */}
              <span className="block">
                {issue.category} · {issue.terms.join(", ")} · {issue.reports} relatos de {issue.people} pessoas desde {formatClock(issue.since)}
              </span>
            </span>
          </p>
        ))}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Pesquisar conversa ou chamado"
            aria-label="Pesquisar conversa ou chamado"
            className="h-9 w-full rounded-[10px] bg-muted pr-3 pl-9 text-sm transition-shadow duration-150 outline-none placeholder:text-muted-foreground focus-visible:bg-surface focus-visible:shadow-[0_0_0_1px_var(--ring),0_0_0_4px_oklch(0.6_0.1_214/0.14)] max-md:h-11 max-md:text-base [&::-webkit-search-cancel-button]:appearance-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Controle segmentado: as quatro visões cabem na coluna, com a contagem ao lado do nome. */}
        <div className="flex rounded-[10px] bg-muted p-0.5" role="tablist" aria-label="Filtrar conversas">
          {FILTERS.map(({ id, label }) => {
            const count = conversations.filter((c) => matchesFilter(c, id, analystId)).length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "tap-target h-7 flex-auto rounded-lg px-1.5 text-xs font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring max-md:h-9",
                  filter === id ? "bg-surface text-foreground shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.1)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label} {id !== "all" && <span className="font-normal tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="scrollbar-quiet flex-1 space-y-0.5 overflow-y-auto p-2">
        {visible.length === 0 && (
          <li className="flex flex-col items-center gap-3 px-6 py-14 text-center text-sm text-muted-foreground">
            <Inbox className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
            {query.trim() ? `Nada encontrado para “${query.trim()}”.` : EMPTY[filter]}
          </li>
        )}
        {visible.map((c) => {
          const line = statusLine(c, analystId);
          const selected = selectedId === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex w-full gap-3 rounded-xl px-3 py-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted",
                  // Em tela estreita a lista ocupa a tela toda: não há "selecionada" para destacar.
                  selected ? "lg:bg-accent max-lg:hover:bg-muted/70" : "hover:bg-muted/70",
                )}
              >
                <PersonAvatar name={c.employee.name} online={c.status !== "closed"} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.employee.name}</span>
                    {c.lastMessage && <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatListTime(c.lastMessage.at)}</span>}
                  </div>
                  {c.lastMessage && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {c.lastMessage.role === "agent" && <Bot className="size-3 shrink-0" />}
                      <span className="truncate">{c.lastMessage.text}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StatusDot tone={line.tone}>{line.text}</StatusDot>
                    {/* Texto, não só cor; o funcionário nunca vê este rótulo. */}
                    {c.frustration?.level === "high" && (
                      <span className="rounded-full bg-danger-soft px-2 py-px text-[11px] font-medium whitespace-nowrap text-danger-foreground" title={c.frustration.reason ?? undefined}>
                        Frustração alta
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
