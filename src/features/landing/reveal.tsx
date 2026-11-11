"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Entra com opacidade, um leve desfoque e 24 px de subida quando chega à tela.
 * Com prefers-reduced-motion o conteúdo já aparece parado (as classes são motion-safe).
 * O estado fica num data-attribute do DOM, sem re-render.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.dataset.shown = "true";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.shown = "true";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "motion-safe:transition-[opacity,translate,filter] motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        "motion-safe:data-[shown=false]:translate-y-6 motion-safe:data-[shown=false]:opacity-0 motion-safe:data-[shown=false]:blur-[6px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
