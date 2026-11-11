"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Telas mais altas que largas (celular e tablet em pé) recebem o enquadramento vertical. */
const PORTRAIT = "(max-aspect-ratio: 4/5)";
/** Com movimento reduzido nenhuma fonte de vídeo casa: o navegador nem baixa o arquivo e fica o pôster. */
const MOTION = "(prefers-reduced-motion: no-preference)";

const media = "absolute inset-0 size-full object-cover object-[72%_50%] [@media(max-aspect-ratio:4/5)]:object-top";

/**
 * A cena 3D do farol (Blender, Cycles) como fundo de tela cheia do topo.
 * O pôster é o primeiro quadro do loop e carrega primeiro; o vídeo, mudo e em loop, entra por cima
 * sem troca visível. O componente pausa o vídeo fora da tela e publica na seção o quanto ela já
 * rolou (--hero-p, de 0 a 1), que move a cena mais devagar que a página e apaga o texto.
 */
export function HeroScene({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = root.current;
    const section = el?.closest("section");
    if (!el || !section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;

    const update = () => {
      frame = 0;
      if (reduced.matches) {
        section.style.removeProperty("--hero-p");
        return;
      }
      const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, section.offsetHeight)));
      section.style.setProperty("--hero-p", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame && visible) frame = requestAnimationFrame(update);
    };
    const syncVideo = () => {
      const v = video.current;
      if (!v) return;
      if (reduced.matches || !visible) v.pause();
      else void v.play().catch(() => {});
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      syncVideo();
      schedule();
    });
    // As fontes do vídeo têm media query (formato da tela e movimento reduzido), que o navegador só
    // avalia ao carregar. Se a tela girar ou a preferência mudar, load() refaz a escolha.
    const shape = window.matchMedia(PORTRAIT);
    const reselect = () => {
      video.current?.load();
      syncVideo();
      schedule();
    };

    observer.observe(section);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", reselect);
    shape.addEventListener("change", reselect);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", reselect);
      shape.removeEventListener("change", reselect);
    };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className={cn(
        "absolute inset-0 origin-[50%_30%] will-change-transform [transform:translate3d(0,calc(var(--hero-p,0)*14svh),0)_scale(calc(1+var(--hero-p,0)*0.05))]",
        className,
      )}
    >
      <picture>
        <source media={PORTRAIT} srcSet="/landing/farol-landing-retrato-poster.webp" type="image/webp" />
        <img
          src="/landing/farol-landing-poster.webp"
          alt=""
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className={media}
        />
      </picture>
      <video ref={video} className={media} autoPlay muted loop playsInline preload="auto" tabIndex={-1} disablePictureInPicture>
        <source src="/landing/farol-landing-retrato.webm" type="video/webm" media={`${MOTION} and ${PORTRAIT}`} />
        <source src="/landing/farol-landing-retrato.mp4" type="video/mp4" media={`${MOTION} and ${PORTRAIT}`} />
        <source src="/landing/farol-landing.webm" type="video/webm" media={MOTION} />
        <source src="/landing/farol-landing.mp4" type="video/mp4" media={MOTION} />
      </video>
    </div>
  );
}
