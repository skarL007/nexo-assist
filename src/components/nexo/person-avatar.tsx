import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/domain/employee";
import { cn } from "@/lib/utils";

// Cor estável por pessoa: o mesmo nome sempre gera a mesma cor.
const PALETTE = [
  "bg-[oklch(0.92_0.035_212)] text-[oklch(0.36_0.075_212)]", // petróleo
  "bg-[oklch(0.93_0.05_88)] text-[oklch(0.4_0.08_75)]", // âmbar suave
  "bg-[oklch(0.92_0.03_150)] text-[oklch(0.38_0.06_150)]", // sálvia
  "bg-[oklch(0.92_0.04_52)] text-[oklch(0.42_0.1_45)]", // terracota
  "bg-[oklch(0.93_0.018_232)] text-[oklch(0.38_0.04_232)]", // névoa
  "bg-[oklch(0.92_0.025_105)] text-[oklch(0.4_0.06_105)]", // oliva
  "bg-[oklch(0.91_0.03_20)] text-[oklch(0.43_0.09_20)]", // argila
];

const colorFor = (name: string) => PALETTE[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

export function PersonAvatar({ name, className, online }: { name: string; className?: string; online?: boolean }) {
  return (
    <span className="relative inline-flex h-fit shrink-0">
      <Avatar className={cn("size-9", className)}>
        <AvatarFallback className={cn("text-xs font-semibold", colorFor(name))}>{initials(name)}</AvatarFallback>
      </Avatar>
      {online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-surface bg-success" />}
    </span>
  );
}
