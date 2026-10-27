"use client";

import { ArrowUp } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export interface ComposerHandle {
  prefill: (text: string) => void;
}

interface ComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
  remaining: number;
  limit: number;
}

/** Caixa de mensagem. Enter envia; Shift+Enter quebra linha. */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { onSend, disabled, placeholder, remaining, limit },
  ref,
) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    prefill(value) {
      setText(value);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }));

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  };

  return (
    <div className="space-y-1.5">
      <form
        className="flex items-end gap-2 rounded-xl border bg-surface p-2 shadow-xs focus-within:ring-2 focus-within:ring-ring/30"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Mensagem"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <Button type="submit" size="sm" disabled={disabled || !text.trim()}>
          <ArrowUp className="size-4" /> Enviar
        </Button>
      </form>
      <p className="flex justify-between gap-4 text-xs text-muted-foreground">
        {/* As mensagens vão para um modelo de IA externo: nada de senha ou dado pessoal real. */}
        <span>Protótipo com dados fictícios · não envie senhas nem dados pessoais.</span>
        <span className="shrink-0">
          {limit - remaining}/{limit} mensagens nesta sessão
        </span>
      </p>
    </div>
  );
});
