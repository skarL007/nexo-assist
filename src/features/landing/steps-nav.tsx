"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Lista presa ao lado dos passos (telas largas): o passo que chegou ao meio da tela fica em
 * preto, os outros em cinza. Cada item é um link para o passo, então funciona pelo teclado.
 */
export function StepsNav({ steps }: { steps: readonly { id: string; title: string }[] }) {
  const [active, setActive] = useState<string>(steps[0]?.id ?? "");

  useEffect(() => {
    const targets = steps.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    let frame = 0;
    // Ativo = o último passo cujo topo já passou da metade da tela (antes disso, o primeiro).
    const update = () => {
      frame = 0;
      const middle = window.innerHeight * 0.5;
      let current = targets[0]?.id ?? "";
      for (const target of targets) if (target.getBoundingClientRect().top <= middle) current = target.id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [steps]);

  return (
    <nav aria-label="Passos" className="sticky top-28">
      <ol className="space-y-1">
        {steps.map((step, index) => {
          const current = step.id === active;
          return (
            <li key={step.id}>
              <a
                href={`#${step.id}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "group relative flex gap-4 rounded-lg py-3 pr-2 pl-5 text-[19px] leading-snug font-medium tracking-[-0.01em] transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-3 bottom-3 left-0 w-px transition-colors duration-300",
                    current ? "bg-foreground" : "bg-border",
                  )}
                />
                <span aria-hidden="true" className="font-mono text-[13px] leading-[1.9] tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-balance">{step.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
