import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** O farol da marca: torre, lanterna e o feixe para a direita. Herda a cor do texto. */
export function LighthouseGlyph({ className, beam = true }: { className?: string; beam?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {beam && <path d="M13.2 8.4 22 4.4v8z" opacity=".5" />}
      <path d="M7.6 6.7 10.5 3.6l2.9 3.1z" />
      <rect x="8.5" y="7.3" width="4" height="2.7" rx=".5" />
      <path d="M8.8 10.8h3.4l1.1 8.6H7.7z" />
      <rect x="6.2" y="19.8" width="8.6" height="1.6" rx=".6" />
    </svg>
  );
}

/** Marca do Farol Desk: o farol âmbar num quadrado cor de mar à noite. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-[9px] bg-mark text-beam", className)}>
      <LighthouseGlyph className="size-[1.15rem]" />
    </span>
  );
}

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5 font-serif text-[17px] leading-none font-semibold tracking-tight", inverted && "text-ink-foreground")}>
      <BrandMark />
      {PRODUCT_NAME}
    </span>
  );
}
