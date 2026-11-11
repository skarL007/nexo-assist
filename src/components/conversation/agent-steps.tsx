"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import type { TraceStep } from "@/domain/message";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da resposta do agent: nome, horário e os passos que ele deu, pendurados na linha
 * do tempo à esquerda (a linha e o ponto âmbar são desenhados por AgentReply).
 * O botão "por quê?" abre o detalhe da decisão.
 */
export function AgentSteps({
  steps,
  working = false,
  open,
  onToggle,
  time,
}: {
  steps: TraceStep[];
  working?: boolean;
  open?: boolean;
  onToggle?: () => void;
  time?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-serif text-[15px] leading-none font-semibold tracking-tight text-foreground">{PRODUCT_NAME}</span>
        {time && <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{time}</span>}
      </div>

      {(steps.length > 0 || working) && (
        <ol className="space-y-1 text-xs text-muted-foreground">
          {steps.map((step, index) => (
            <li key={index} className="relative flex items-center">
              <span
                className={cn(
                  "absolute -left-[26px] grid size-3.5 place-items-center rounded-full bg-background ring-2 ring-background",
                  step.ok ? "text-success-foreground" : "text-danger-foreground",
                )}
              >
                {step.ok ? <Check className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={2.5} />}
              </span>
              {step.label}
            </li>
          ))}
          {working && (
            <li className="relative flex items-center">
              <span className="absolute -left-[26px] grid size-3.5 place-items-center rounded-full bg-background ring-2 ring-background">
                <Loader2 className="size-3 animate-spin text-primary" />
              </span>
              {steps.length ? "trabalhando…" : "pensando…"}
            </li>
          )}
        </ol>
      )}

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(
            "ring-beam-focus inline-flex h-6 items-center gap-0.5 rounded-full pr-1.5 pl-2.5 text-xs font-medium text-beam-foreground transition-colors duration-150 outline-none",
            open ? "bg-beam" : "bg-beam-soft hover:bg-beam/60",
          )}
        >
          por quê?
          <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
