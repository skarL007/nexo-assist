import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/domain/employee";
import { cn } from "@/lib/utils";

// Cor estável por pessoa: o mesmo nome sempre gera a mesma cor.
const PALETTE = [
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-rose-100 text-rose-800",
  "bg-slate-200 text-slate-700",
  "bg-orange-100 text-orange-800",
];

const colorFor = (name: string) => PALETTE[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

export function PersonAvatar({ name, className, online }: { name: string; className?: string; online?: boolean }) {
  return (
    <span className="relative inline-flex">
      <Avatar className={cn("size-9", className)}>
        <AvatarFallback className={cn("text-xs font-semibold", colorFor(name))}>{initials(name)}</AvatarFallback>
      </Avatar>
      {online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-surface bg-success" />}
    </span>
  );
}
