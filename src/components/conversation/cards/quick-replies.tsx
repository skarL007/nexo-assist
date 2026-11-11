"use client";

import { Button } from "@/components/ui/button";

/** Respostas rápidas em chips: clicar envia o texto como mensagem. */
export function QuickReplies({ options, onChoose }: { options: string[]; onChoose?: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button key={option} size="sm" variant="outline" className="rounded-full px-3.5" disabled={!onChoose} onClick={() => onChoose?.(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}
