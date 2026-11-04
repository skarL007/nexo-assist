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

  return (
    <div className="space-y-1.5">
      {image && (
        <div className="flex items-center gap-2 rounded-lg border bg-surface p-1.5 pr-2 text-xs text-muted-foreground w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), fora do otimizador */}
          <img src={image.previewUrl} alt="Imagem anexada" className="size-12 rounded object-cover" />
          <span>Imagem anexada</span>
          <button
            type="button"
            className="rounded p-1 hover:bg-muted"
            aria-label="Remover imagem"
            onClick={() => setImage(null)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {imageError && <p role="alert" className="text-xs text-destructive">{imageError}</p>}
      <form
        className="flex items-end gap-2 rounded-xl border bg-surface p-2 shadow-xs focus-within:ring-2 focus-within:ring-ring/30"
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
          size="sm"
          variant="ghost"
          disabled={disabled}
          aria-label="Anexar imagem"
          title="Anexar captura de tela ou foto"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
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
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <Button type="submit" size="sm" disabled={disabled || (!text.trim() && !image)}>
          <ArrowUp className="size-4" /> Enviar
        </Button>
      </form>
      <p className="flex justify-between gap-4 text-xs text-muted-foreground">
        {/* As mensagens vão para um modelo de IA externo: nada de senha ou dado pessoal real. */}
        <span>
          Protótipo com dados fictícios · não envie senhas nem dados pessoais. <AboutPrototypeLink />
        </span>
        <span className="shrink-0">
          {limit - remaining}/{limit} mensagens nesta sessão
        </span>
      </p>
    </div>
  );
});
