"use client";

import { Button } from "@/components/ui/button";

/** Botões de resposta rápida: clicar envia o texto como mensagem. */
export function QuickReplies({ options, onChoose }: { options: string[]; onChoose?: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button key={option} size="sm" variant="outline" disabled={!onChoose} onClick={() => onChoose?.(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}
