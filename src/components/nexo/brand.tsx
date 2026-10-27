import { cn } from "@/lib/utils";

/** Marca do Nexo Assist: o "N" num quadrado azul. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground", className)}>
      N
    </span>
  );
}

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", inverted && "text-navy-foreground")}>
      <BrandMark />
      Nexo Assist
    </span>
  );
}
