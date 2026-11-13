"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Brand } from "@/components/nexo/brand";
import { cn } from "@/lib/utils";
import { DEMO_HREF, HERO_SKY, NAV_LINKS, PAGE_LIGHT } from "./content";

/**
 * Barra fixa da landing. Sobre a cena do farol ela é transparente, com texto branco; depois que
 * o topo passa, vira o vidro claro do app. No celular, as âncoras ficam num menu que abre abaixo
 * da barra (fecha com Esc, ao escolher um link ou ao tocar fora).
 */
export function LandingNav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    const hero = document.getElementById("topo");
    const mist = hero?.querySelector<HTMLElement>("[data-mist]");
    const immersion = document.getElementById("imersao");
    let frame = 0;
    const update = () => {
      frame = 0;
      // Vira clara quando a névoa da base do topo já clareou o fundo atrás da barra
      // (antes disso o texto branco ainda tem contraste; depois, não teria).
      const bar = header.current?.offsetHeight ?? 48;
      const limit = hero ? hero.offsetHeight - (mist?.offsetHeight ?? hero.offsetHeight * 0.3) * 0.62 - bar : 0;
      const sceneRange = immersion ? immersion.offsetHeight - window.innerHeight : 0;
      const sceneProgress = sceneRange > 0 && immersion ? -immersion.getBoundingClientRect().top / sceneRange : -1;
      const overScene = sceneProgress > 0.07 && sceneProgress < 0.82;
      setSolid(!overScene && window.scrollY > Math.max(0, limit));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const light = solid || open;

  // A barra do navegador do celular acompanha a barra da página: céu no topo, claro depois.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? PAGE_LIGHT : HERO_SKY);
  }, [light]);

  return (
    <header
      ref={header}
      data-solid={light}
      className={cn(
        "group/nav fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,color] duration-300",
        !light && "border-transparent bg-transparent text-white",
        light && "border-black/[0.08] text-foreground backdrop-blur-xl backdrop-saturate-150",
        // Com o menu aberto o fundo fica opaco: o texto da página não vaza por trás dos links.
        light && (open ? "bg-background shadow-[0_24px_48px_-24px_rgb(22_20_44/0.3)]" : "bg-[color-mix(in_oklch,var(--background)_82%,transparent)]"),
      )}
    >
      <div className="mx-auto flex h-12 w-full max-w-[1120px] items-center justify-between gap-3 px-5 sm:h-14 sm:px-8">
        <Link
          href="/"
          aria-label="Farol Desk, início"
          className={cn(
            "-mx-1.5 rounded-lg px-1.5 py-1 outline-none focus-visible:ring-2",
            light ? "focus-visible:ring-ring" : "focus-visible:ring-white [&_span>span]:ring-1 [&_span>span]:ring-white/20",
          )}
        >
          <Brand />
        </Link>

        <nav aria-label="Seções" className="hidden md:block">
          <ul className="flex items-center gap-1 text-[13px] font-medium">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors outline-none focus-visible:ring-2",
                    light
                      ? "text-foreground/70 hover:bg-black/[0.05] hover:text-foreground focus-visible:ring-ring"
                      : "text-white/85 [text-shadow:0_1px_10px_rgb(20_18_40/0.45)] hover:bg-white/12 hover:text-white focus-visible:ring-white",
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href={DEMO_HREF}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              light
                ? "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_14%)] focus-visible:ring-ring focus-visible:ring-offset-background"
                : "bg-white text-[#1d1d1f] hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-[#3b3950]",
            )}
          >
            Usar a demo
          </Link>
          <button
            ref={toggle}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              "-mr-2 grid size-10 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 md:hidden",
              light ? "hover:bg-black/[0.05] focus-visible:ring-ring" : "hover:bg-white/12 focus-visible:ring-white",
            )}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      <nav id={menuId} aria-label="Seções" hidden={!open} className="border-t border-black/[0.06] md:hidden">
        <ul className="mx-auto max-w-[1120px] px-5 pt-1 pb-4">
          {NAV_LINKS.map((link) => (
            <li key={link.href} className="border-b border-black/[0.06] last:border-b-0">
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="-mx-2 flex min-h-12 items-center rounded-lg px-2 text-[17px] font-medium tracking-[-0.01em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
