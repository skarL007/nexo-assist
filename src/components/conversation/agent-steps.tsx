"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import type { TraceStep } from "@/domain/message";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da resposta do agent: nome e horário em cima; embaixo, os passos que ele deu como
 * etiquetas discretas e, no fim da mesma linha, o "por quê?" que abre o detalhe da decisão.
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
  const hasRow = steps.length > 0 || working || !!onToggle;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] leading-none font-semibold text-foreground">{PRODUCT_NAME}</span>
        {time && <span className="text-[11px] leading-none text-muted-foreground tabular-nums">{time}</span>}
      </div>

      {hasRow && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(steps.length > 0 || working) && (
            <ol className="contents">
              {steps.map((step, index) => (
                <li
                  key={index}
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-black/[0.045] pr-2.5 pl-1.5 text-[12px] text-muted-foreground"
                >
                  {step.ok ? (
                    <Check className="size-3.5 text-success-foreground" strokeWidth={2.5} aria-label="feito" />
                  ) : (
                    <X className="size-3.5 text-danger-foreground" strokeWidth={2.5} aria-label="falhou" />
                  )}
                  {step.label}
                </li>
              ))}
              {working && (
                <li className="inline-flex h-6 items-center gap-1.5 rounded-full bg-black/[0.045] pr-2.5 pl-1.5 text-[12px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
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
                "ring-beam-focus inline-flex h-6 items-center gap-1 rounded-full pr-1.5 pl-2 text-[12px] font-medium transition-colors duration-150 outline-none",
                open ? "bg-beam text-[oklch(0.3_0.06_70)]" : "bg-beam-soft text-beam-foreground hover:bg-beam/50",
              )}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-beam ring-2 ring-white/70" />
              por quê?
              <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
