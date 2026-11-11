"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A tela do produto chega inclinada, em perspectiva, e endireita conforme a página rola.
 * Com prefers-reduced-motion fica reta. O ângulo vai numa variável CSS (--tilt, de 1 a 0).
 */
export function ProductShot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (reduced.matches) {
        el.style.setProperty("--tilt", "0");
        return;
      }
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      // 0 quando o topo entra pela base da tela; 1 quando chega a 30% do alto da tela.
      const progress = Math.min(1, Math.max(0, (vh - top) / (vh * 0.7)));
      el.style.setProperty("--tilt", (1 - progress).toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div className="[perspective:2000px]">
      <div
        ref={ref}
        className="origin-[50%_100%] [--tilt-max:10deg] [transform:rotateX(calc(var(--tilt,0)*var(--tilt-max)))_scale(calc(1-var(--tilt,0)*0.06))] will-change-transform lg:[--tilt-max:22deg]"
      >
        {children}
      </div>
    </div>
  );
}
