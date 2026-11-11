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
        <div className="flex w-fit items-center gap-3 rounded-2xl bg-surface p-1.5 pr-2 text-xs text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_14px_-6px_rgba(0,0,0,0.12)]">
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
        className="flex items-end gap-1 rounded-[26px] bg-surface/90 p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_8px_28px_-10px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_var(--ring),0_0_0_4px_oklch(0.6_0.1_214/0.14),0_8px_28px_-10px_rgba(0,0,0,0.16)] has-[textarea:disabled]:bg-muted/70 has-[textarea:disabled]:shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
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
          className="text-muted-foreground"
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
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] leading-normal outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed"
        />
        {/* Envio em círculo, como no iMessage: desligado fica cinza (não um petróleo desbotado). */}
        <Button
          type="submit"
          size="icon"
          className="disabled:bg-black/[0.08] disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
          disabled={!canSend}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.5} /> <span className="sr-only">Enviar</span>
        </Button>
      </form>
      <p className="flex flex-col gap-0.5 px-4 text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:justify-between sm:gap-4">
        {/* As mensagens vão para um modelo de IA externo: nada de senha ou dado pessoal real. */}
        <span>
          Protótipo com dados fictícios · não envie senhas nem dados pessoais. <AboutPrototypeLink />
        </span>
        <span className="shrink-0 tabular-nums">
          {limit - remaining}/{limit} mensagens nesta sessão
        </span>
      </p>
    </div>
  );
});
