"use client";

import { useEffect, useRef, useState } from "react";

/** "live": o stream está aberto; "polling": sem stream, a tela confere de tempos em tempos. */
export type LiveMode = "live" | "polling";

/** Sem stream por mais que isso (fora as reconexões normais), a tela volta ao polling. */
const FALLBACK_AFTER_MS = 3000;
/** Stream recusado (ex.: erro HTTP): tenta de novo depois disso. */
const RETRY_CLOSED_MS = 30_000;

/** `?ao-vivo=0` desliga o stream (para comparar com o polling). */
function disabledByUrl(): boolean {
  return new URLSearchParams(window.location.search).get("ao-vivo") === "0";
}

/**
 * Abre um EventSource em `url` e chama `onChange` a cada evento "change".
 * Aba escondida fecha o stream (não segura conexão à toa); ao voltar, reabre e
 * chama `onChange` para pegar o que mudou nesse meio-tempo. Devolve o modo,
 * para a tela decidir se ainda precisa de polling.
 */
export function useLiveUpdates(url: string, onChange: () => void, enabled = true): LiveMode {
  const [mode, setMode] = useState<LiveMode>("polling");
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined" || disabledByUrl()) return;
    let source: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let opened = false;

    const open = () => {
      source = new EventSource(url);
      source.onopen = () => {
        clearTimeout(fallbackTimer);
        // Reconexão: o que mudou enquanto o stream estava fechado não gerou evento.
        if (opened) onChangeRef.current();
        opened = true;
        setMode("live");
      };
      source.addEventListener("change", () => onChangeRef.current());
      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          setMode("polling");
          close();
          retryTimer = setTimeout(open, RETRY_CLOSED_MS);
          return;
        }
        // Reconexão automática do navegador (o servidor fecha cada stream em ~50 s).
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => setMode("polling"), FALLBACK_AFTER_MS);
      };
    };
    const close = () => {
      source?.close();
      source = null;
      clearTimeout(fallbackTimer);
      clearTimeout(retryTimer);
    };
    const onVisibility = () => {
      if (document.hidden) {
        close();
        setMode("polling");
      } else if (!source) {
        open();
        onChangeRef.current();
      }
    };

    if (!document.hidden) open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      close();
      setMode("polling");
    };
  }, [url, enabled]);

  return mode;
}
