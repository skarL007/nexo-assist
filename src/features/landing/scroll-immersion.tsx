"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Imersão comandada pela rolagem: uma tomada contínua do farol (Blender, Cycles), desenhada quadro a quadro
 * num <canvas> conforme a seção rola. A câmera parte do mar, sobe pela torre até a lanterna, o feixe gira até
 * a lente e a luz se abre no cinza claro da página, de onde sai a seção do painel "por quê?".
 *
 * - Os quadros (WebP) só começam a baixar quando a seção se aproxima e a página já carregou; vêm em passadas
 *   (1 a cada 16, depois 8, 4, 2, 1), então a rolagem já funciona com poucos quadros e ganha detalhe depois.
 * - O quadro desenhado segue a rolagem com amortecimento e funde os dois quadros vizinhos: sem degrau nem tremor.
 * - Com prefers-reduced-motion, a seção vira uma tela parada (um quadro do meio da tomada) com as três frases.
 * - Sem JavaScript, fica o primeiro quadro e as frases (estilo no <noscript>).
 */

const PORTRAIT = "(max-aspect-ratio: 4/5)";
const REDUCED = "(prefers-reduced-motion: reduce)";

type FrameSet = { dir: string; count: number; still: number; focusX: number };

/** Horizontal: 1600×900; vertical (celular e tablet em pé): 720×1280. `still` é o quadro da tela parada. */
const WIDE: FrameSet = { dir: "/landing/imersao/d", count: 134, still: 52, focusX: 0.56 };
const TALL: FrameSet = { dir: "/landing/imersao/m", count: 90, still: 62, focusX: 0.5 };

const frameUrl = (set: FrameSet, index: number) => `${set.dir}/${String(index).padStart(3, "0")}.webp`;

/** Frases e o trecho da rolagem (0 a 1) em que cada uma aparece. */
const PHRASES = [
  { text: <>Toda pergunta de TI vira uma conversa.</>, from: 0.07, to: 0.3 },
  { text: <>O agent entende, consulta e decide.</>, from: 0.36, to: 0.58 },
  {
    text: (
      <>
        E mostra o <span className="text-beam">porquê</span>.
      </>
    ),
    from: 0.63,
    to: 0.8,
  },
] as const;
const FADE = 0.05;

function phraseStyle(from: number, to: number) {
  const p = "var(--imm-p, 0)";
  const mid = (from + to) / 2;
  return {
    opacity: `clamp(0, min(calc((${p} - ${from}) / ${FADE}), calc((${to} - ${p}) / ${FADE})), 1)`,
    translate: `0 calc((${p} - ${mid}) * -28svh)`,
  };
}

/** Passadas de carregamento: primeiro um quadro a cada 16, depois os do meio. */
function loadOrder(count: number) {
  const order: number[] = [];
  const seen = new Set<number>();
  for (const stride of [16, 8, 4, 2, 1]) {
    for (let i = 0; i < count; i += stride) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  if (!seen.has(count - 1)) order.splice(1, 0, count - 1);
  return order;
}

export function ScrollImmersion() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!section || !canvas || !ctx) return;

    const reduced = window.matchMedia(REDUCED);
    const tall = window.matchMedia(PORTRAIT);
    let set = tall.matches ? TALL : WIDE;
    let images: (HTMLImageElement | null)[] = [];
    let generation = 0;
    let near = false;
    let loading = false;
    let frame = 0;
    let last = 0;
    let target = 0;
    let current = -1;
    let drawn = "";

    const progress = () => {
      const rect = section.getBoundingClientRect();
      const range = section.offsetHeight - window.innerHeight;
      return range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 0;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        drawn = "";
      }
    };

    const paint = (img: HTMLImageElement, alpha: number) => {
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - dw) * set.focusX, (ch - dh) / 2, dw, dh);
    };

    /** Desenha a posição (fracionária) `pos` da tomada com o que já carregou. */
    const draw = (pos: number) => {
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      let base = -1;
      for (let d = 0; d < set.count; d++) {
        if (images[i0 - d]) {
          base = i0 - d;
          break;
        }
        if (images[i0 + 1 + d]) {
          base = i0 + 1 + d;
          break;
        }
      }
      if (base < 0) return;
      const next = base === i0 && frac > 0.02 ? images[i0 + 1] : null;
      const key = `${base}:${next ? frac.toFixed(2) : 0}:${canvas.width}`;
      if (key === drawn) return;
      drawn = key;
      ctx.imageSmoothingQuality = "high";
      paint(images[base] as HTMLImageElement, 1);
      if (next) paint(next, frac);
      ctx.globalAlpha = 1;
      canvas.dataset.frame = String(base);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (current < 0) current = target;
      // Amortecimento exponencial (~110 ms): a tomada acompanha a rolagem sem degrau.
      current += (target - current) * (1 - Math.exp(-dt / 110));
      if (Math.abs(target - current) < 0.0004) current = target;
      section.style.setProperty("--imm-p", current.toFixed(4));
      draw(current * (set.count - 1));
      if (current !== target) frame = requestAnimationFrame(tick);
      else last = 0;
    };

    const schedule = () => {
      if (reduced.matches) return;
      target = progress();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const load = () => {
      if (loading || !near || reduced.matches) return;
      loading = true;
      const mine = ++generation;
      const order = loadOrder(set.count);
      images = new Array(set.count).fill(null);
      let next = 0;
      const worker = async () => {
        while (next < order.length && mine === generation) {
          const index = order[next++] as number;
          const img = new Image();
          img.decoding = "async";
          img.src = frameUrl(set, index);
          try {
            await img.decode();
          } catch {
            continue;
          }
          if (mine !== generation) return;
          images[index] = img;
          drawn = "";
          schedule();
        }
      };
      for (let k = 0; k < 6; k++) void worker();
    };

    const start = () => {
      if (document.readyState === "complete") load();
      else window.addEventListener("load", load, { once: true });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !near) {
          near = true;
          start();
        }
      },
      { rootMargin: "100% 0px 100% 0px" },
    );

    const onShape = () => {
      set = tall.matches ? TALL : WIDE;
      generation++;
      loading = false;
      images = [];
      drawn = "";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      load();
    };
    const onMotion = () => {
      if (reduced.matches) {
        section.style.removeProperty("--imm-p");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawn = "";
      } else {
        load();
        schedule();
      }
    };
    const onResize = () => {
      resize();
      schedule();
    };

    resize();
    if (!reduced.matches) {
      target = progress();
      section.style.setProperty("--imm-p", target.toFixed(4));
    }
    section.dataset.ready = "true";
    observer.observe(section);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    tall.addEventListener("change", onShape);
    reduced.addEventListener("change", onMotion);
    return () => {
      generation++;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("load", load);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      tall.removeEventListener("change", onShape);
      reduced.removeEventListener("change", onMotion);
    };
  }, []);

  const media = "absolute inset-0 size-full object-cover";

  return (
    <section
      ref={sectionRef}
      id="imersao"
      aria-label="O Farol Desk em três frases"
      data-ready="false"
      className="relative bg-[#3b394c] text-white motion-safe:h-[460svh]"
    >
      {/* Sem JavaScript: a primeira imagem e as três frases, sem rolagem presa. */}
      <noscript>
        <style>
          {
            "#imersao{height:auto!important}#imersao [data-frase]{opacity:1!important;translate:none!important}#imersao [data-frases]{display:flex!important;flex-direction:column;gap:1.25rem}#imersao canvas{display:none}"
          }
        </style>
      </noscript>
      <div className="sticky top-0 h-svh min-h-[34rem] overflow-hidden motion-reduce:relative">
        <picture>
          <source media={`${REDUCED} and ${PORTRAIT}`} srcSet={frameUrl(TALL, TALL.still)} type="image/webp" />
          <source media={REDUCED} srcSet={frameUrl(WIDE, WIDE.still)} type="image/webp" />
          <source media={PORTRAIT} srcSet={frameUrl(TALL, 0)} type="image/webp" />
          <img
            src={frameUrl(WIDE, 0)}
            alt=""
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            data-imersao-poster=""
            className={cn(media, "object-[56%_50%] [@media(max-aspect-ratio:4/5)]:object-center")}
          />
        </picture>
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full motion-reduce:hidden" />

        {/* Véus: do lado do texto (horizontal) ou embaixo (vertical), da cor das sombras do céu. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [@media(max-aspect-ratio:4/5)]:hidden"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 0% 100%, rgb(22 20 44 / 0.62), transparent), linear-gradient(90deg, rgb(22 20 44 / 0.5) 0%, rgb(22 20 44 / 0.34) 32%, rgb(22 20 44 / 0.1) 56%, transparent 72%)",
            opacity: "clamp(0, calc((0.86 - var(--imm-p, 0)) / 0.06), 1)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[62%] [@media(max-aspect-ratio:4/5)]:block"
          style={{
            background: "linear-gradient(to top, rgb(22 20 44 / 0.74) 22%, rgb(22 20 44 / 0.46) 52%, transparent)",
            opacity: "clamp(0, calc((0.86 - var(--imm-p, 0)) / 0.06), 1)",
          }}
        />
        {/* Entrada: a página clara vira o mar escuro numa névoa, que some no começo da rolagem. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-background via-background/55 to-transparent"
          style={{ opacity: "clamp(0, calc(1 - var(--imm-p, 0) * 16), 1)" }}
        />
        {/* Movimento reduzido: a tela parada termina na mesma névoa que leva ao claro. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[24%] bg-gradient-to-t from-background to-transparent motion-reduce:block"
        />

        {/* As frases ficam embaixo, sobre o mar escuro: o feixe corta a altura do meio da tela e passaria atrás delas. */}
        <div className="absolute inset-0 mx-auto flex w-full max-w-[1120px] items-end px-5 pb-[13svh] sm:px-8 [@media(max-aspect-ratio:4/5)]:pb-[16svh] motion-reduce:pb-[27svh] motion-reduce:[@media(max-aspect-ratio:4/5)]:pb-[27svh]">
          <div
            data-frases=""
            className="grid max-w-[min(30rem,92%)] [grid-template-areas:'frase'] motion-reduce:flex motion-reduce:flex-col motion-reduce:gap-5 sm:max-w-[34rem] lg:max-w-[38rem]"
          >
            {PHRASES.map((phrase, index) => (
              <p
                key={index}
                data-frase=""
                style={phraseStyle(phrase.from, phrase.to)}
                className="font-serif text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] font-semibold tracking-[-0.04em] text-balance [grid-area:frase] [text-shadow:0_1px_24px_rgb(22_20_44/0.35)] motion-reduce:text-[clamp(1.75rem,3.6vw,3rem)] motion-reduce:opacity-100! motion-reduce:translate-none!"
              >
                {phrase.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
