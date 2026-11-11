"use client";

import { ArrowUp, ImagePlus, X } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { AboutPrototypeLink } from "@/components/nexo/about-prototype-link";
import { Button } from "@/components/ui/button";
import type { PendingImage } from "../chat-slice";
import { IMAGE_ACCEPT, prepareImage } from "../prepare-image";

export interface ComposerHandle {
  prefill: (text: string, image?: PendingImage | null) => void;
}

interface ComposerProps {
  onSend: (text: string, image?: PendingImage) => void;
  disabled: boolean;
  placeholder: string;
  remaining: number;
  limit: number;
}

/** Caixa de mensagem. Enter envia; Shift+Enter quebra linha. Imagem pelo clipe ou colando (Ctrl+V). */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { onSend, disabled, placeholder, remaining, limit },
  ref,
) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    prefill(value, restored) {
      setText(value);
      if (restored) setImage(restored);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }));

  const attach = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    try {
      setImage(await prepareImage(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Não consegui abrir a imagem.");
    }
  };

  const submit = () => {
    const value = text.trim();
    if ((!value && !image) || disabled) return;
    onSend(value, image ?? undefined);
    setText("");
    setImage(null);
  };

  const canSend = !disabled && (!!text.trim() || !!image);

  return (
    <div className="space-y-2">
      {image && (
        <div className="flex w-fit items-center gap-3 rounded-xl border bg-surface p-1.5 pr-2 text-xs text-muted-foreground shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), fora do otimizador */}
          <img src={image.previewUrl} alt="Imagem anexada" className="size-12 rounded-lg border border-black/5 object-cover" />
          <span className="font-medium text-foreground">Imagem anexada</span>
          <Button type="button" size="icon-xs" variant="ghost" aria-label="Remover imagem" onClick={() => setImage(null)}>
            <X />
          </Button>
        </div>
      )}
      {imageError && (
        <p role="alert" className="text-xs text-destructive">
          {imageError}
        </p>
      )}
      <form
        className="flex items-end gap-1.5 rounded-2xl border bg-surface p-2 shadow-[0_10px_30px_-14px_oklch(0.24_0.028_232/0.28)] transition-colors duration-150 focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15 has-[textarea:disabled]:bg-muted/60 has-[textarea:disabled]:shadow-none"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          aria-label="Escolher imagem"
          onChange={(e) => {
            void attach(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="rounded-xl"
          disabled={disabled}
          aria-label="Anexar imagem"
          title="Anexar captura de tela ou foto"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus />
        </Button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Mensagem"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
            if (file) {
              e.preventDefault();
              void attach(file);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed"
        />
        <Button type="submit" size="icon" className="rounded-xl sm:w-auto sm:px-3.5" disabled={!canSend}>
          <ArrowUp /> <span className="max-sm:sr-only">Enviar</span>
        </Button>
      </form>
      <p className="flex flex-col gap-0.5 px-1 text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:justify-between sm:gap-4">
        {/* As mensagens vão para um modelo de IA externo: nada de senha ou dado pessoal real. */}
        <span>
          Protótipo com dados fictícios · não envie senhas nem dados pessoais. <AboutPrototypeLink />
        </span>
        <span className="shrink-0 tabular-nums">
          <span className="font-mono">
            {limit - remaining}/{limit}
          </span>{" "}
          mensagens nesta sessão
        </span>
      </p>
    </div>
  );
});
