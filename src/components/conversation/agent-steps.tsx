"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import type { TraceStep } from "@/domain/message";
import { cn } from "@/lib/utils";

/**
 * Linha acima da resposta: "Nexo Assist ✓ consultou seus chamados ✓ buscou na central".
 * O botão "por quê?" abre o detalhe da decisão.
 */
export function AgentSteps({
  steps,
  working = false,
  open,
  onToggle,
}: {
  steps: TraceStep[];
  working?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Nexo Assist</span>
      {steps.map((step, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {step.ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-danger" />}
          {step.label}
        </span>
      ))}
      {working && (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3.5 animate-spin" />
          {steps.length ? "trabalhando…" : "pensando…"}
        </span>
      )}
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 rounded px-1 font-medium text-primary hover:underline"
        >
          por quê?
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
