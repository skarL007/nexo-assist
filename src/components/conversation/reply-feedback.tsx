"use client";

import { Check, Headset, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReplyFeedbackProps {
  /** undefined: ainda não avaliou. */
  value: boolean | undefined;
  /** Sem onRate, só mostra a avaliação (é o que o analista vê). */
  onRate?: (helpful: boolean) => void;
  /** "Não resolveu": atalho para pedir um analista. */
  onEscalate?: () => void;
}

/** "Isso resolveu?" embaixo de uma resposta do agent. */
export function ReplyFeedback({ value, onRate, onEscalate }: ReplyFeedbackProps) {
  if (!onRate) {
    if (value === undefined) return null;
    return (
      <p className={`flex items-center gap-1 text-xs ${value ? "text-success" : "text-danger"}`}>
        {value ? <ThumbsUp className="size-3.5" /> : <ThumbsDown className="size-3.5" />}
        {value ? "Funcionário: resolveu" : "Funcionário: não resolveu"}
      </p>
    );
  }

  if (value === true) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5 text-success" /> Obrigado pelo retorno!
      </p>
    );
  }

  if (value === false) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Que pena. Quer ajuda de uma pessoa?</span>
        {onEscalate && (
          <Button size="xs" variant="outline" onClick={onEscalate}>
            <Headset className="size-3.5" /> Falar com um analista
          </Button>
        )}
        <button type="button" className="underline-offset-2 hover:underline" onClick={() => onRate(true)}>
          Na verdade, resolveu
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" role="group" aria-label="Isso resolveu?">
      <span className="mr-1">Isso resolveu?</span>
      <Button size="xs" variant="ghost" onClick={() => onRate(true)}>
        <ThumbsUp className="size-3.5" /> Sim
      </Button>
      <Button size="xs" variant="ghost" onClick={() => onRate(false)}>
        <ThumbsDown className="size-3.5" /> Não
      </Button>
    </div>
  );
}
