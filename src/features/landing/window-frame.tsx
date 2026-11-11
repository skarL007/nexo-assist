import Image from "next/image";
import { cn } from "@/lib/utils";

export type Shot = { src: string; width: number; height: number };

const frame =
  "overflow-hidden bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_70px_-34px_rgb(22_20_44/0.34)] ring-1 ring-black/[0.07]";

/**
 * Moldura das capturas reais do app. "window" é a tela inteira, com a barra de três pontos cinza
 * (sem as cores do macOS, para não competir com a cor de ação). "crop" é um recorte da tela:
 * só a borda fina e os cantos, sem fingir que é uma janela.
 */
export function WindowFrame({
  shot,
  alt,
  className,
  sizes,
  variant = "window",
  maxWidth,
}: {
  shot: Shot;
  alt: string;
  className?: string;
  /** Largura máxima em px de CSS (para nunca ampliar a captura além do tamanho real). */
  maxWidth?: number;
  sizes: string;
  variant?: "window" | "crop";
}) {
  return (
    <div
      style={maxWidth ? { maxWidth } : undefined}
      className={cn(frame, variant === "window" ? "rounded-[14px] sm:rounded-[18px]" : "rounded-[20px] sm:rounded-[24px]", className)}
    >
      {variant === "window" && (
        <div aria-hidden="true" className="flex h-7 items-center gap-1.5 border-b border-black/[0.06] bg-[oklch(0.985_0.002_286)] px-3.5 sm:h-9 sm:gap-2 sm:px-4">
          <span className="size-2 rounded-full bg-black/[0.13] sm:size-2.5" />
          <span className="size-2 rounded-full bg-black/[0.13] sm:size-2.5" />
          <span className="size-2 rounded-full bg-black/[0.13] sm:size-2.5" />
        </div>
      )}
      <Image
        src={shot.src}
        alt={alt}
        width={shot.width}
        height={shot.height}
        sizes={sizes}
        className="block h-auto w-full"
      />
    </div>
  );
}

/**
 * A mesma cena em dois recortes: o largo nas telas grandes e o estreito (capturado no layout de
 * celular do app, ou num painel só) nas pequenas, para o texto da captura continuar legível.
 * O navegador só baixa o que está visível (as imagens são lazy e a outra fica com display: none).
 * O recorte estreito foi capturado a 3x: ele nunca passa do tamanho real (largura / 3), para o
 * texto da captura não ficar maior que o do app.
 */
const NARROW_DENSITY = 3;

export function ShotPair({
  wide,
  narrow,
  alt,
  narrowAlt = alt,
  from = "md",
  wideVariant = "crop",
  narrowVariant = "crop",
  wideSizes,
  narrowSizes = "(min-width: 480px) 440px, 100vw",
  narrowMax = 440,
  className,
}: {
  wide: Shot;
  narrow: Shot;
  alt: string;
  narrowAlt?: string;
  from?: "md" | "lg";
  wideVariant?: "window" | "crop";
  narrowVariant?: "window" | "crop";
  wideSizes: string;
  narrowSizes?: string;
  /** Teto da largura do recorte estreito, em px de CSS. */
  narrowMax?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <WindowFrame shot={wide} alt={alt} variant={wideVariant} sizes={wideSizes} className={from === "md" ? "hidden md:block" : "hidden lg:block"} />
      <WindowFrame
        shot={narrow}
        alt={narrowAlt}
        variant={narrowVariant}
        sizes={narrowSizes}
        maxWidth={Math.min(narrowMax, Math.round(narrow.width / NARROW_DENSITY))}
        className={cn("mx-auto", from === "md" ? "md:hidden" : "lg:hidden")}
      />
    </div>
  );
}
