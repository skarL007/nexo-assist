"use client";

import { Bot, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
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
}

export function ConversationList({ live, knownIssues, conversations, analystId, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<FilterId>("queue");
  const [query, setQuery] = useState("");

  const visible = sortForConsole(conversations.filter((c) => matchesFilter(c, filter, analystId) && matchesSearch(c, query)));

  return (
    <section className="flex w-80 shrink-0 flex-col border-r bg-surface">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl leading-none font-semibold tracking-tight">Conversas</h1>
          <StatusPill tone="success">Disponível</StatusPill>
        </div>
        <p className="-mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground" data-testid="live-indicator">
          <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
          {live ? "Ao vivo" : "Atualiza a cada 4 s"}
        </p>
        {knownIssues.map((issue) => (
          <p key={`${issue.category}-${issue.terms.join()}`} role="status" className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning-foreground">
            <span className="font-semibold">Possível incidente em massa</span> · {issue.category} · {issue.terms.join(", ")} · {issue.reports} relatos de {issue.people} pessoas desde{" "}
            {formatClock(issue.since)}
          </p>
        ))}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar conversa ou chamado" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="-mx-1 flex gap-0.5 border-b" role="tablist">
          {FILTERS.map(({ id, label }) => {
            const count = conversations.filter((c) => matchesFilter(c, id, analystId)).length;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "-mb-px border-b-2 px-2 py-1.5 text-xs font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  filter === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label} {id !== "all" && <span className="opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="scrollbar-quiet flex-1 overflow-y-auto">
        {visible.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa aqui.</li>}
        {visible.map((c) => {
          const line = statusLine(c, analystId);
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "relative flex w-full gap-3 border-b px-4 py-3.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selectedId === c.id && "bg-beam-soft/50 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-beam",
                )}
              >
                <PersonAvatar name={c.employee.name} online={c.status !== "closed"} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.employee.name}</span>
                    {c.lastMessage && (
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatListTime(c.lastMessage.at)}</span>
                    )}
                  </div>
                  {c.lastMessage && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {c.lastMessage.role === "agent" && <Bot className="size-3 shrink-0" />}
                      <span className="truncate">{c.lastMessage.text}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <StatusDot tone={line.tone}>{line.text}</StatusDot>
                    {/* Texto, não só cor; o funcionário nunca vê este rótulo. */}
                    {c.frustration?.level === "high" && (
                      <span className="rounded bg-danger-soft px-1.5 py-px text-[11px] font-medium text-danger-foreground" title={c.frustration.reason ?? undefined}>
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
