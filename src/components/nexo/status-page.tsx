import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/nexo/brand";

/** Página de aviso (acesso restrito, 404, erro), no visual do app: faixa de marca em cima, aviso embaixo. */
export function StatusPage({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-surface shadow-xs">
        <div className="flex items-center justify-between bg-ink px-7 py-5">
          <Brand inverted />
        </div>
        <div className="space-y-6 px-7 py-8">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
          </div>
          {action && <div className="flex">{action}</div>}
        </div>
      </div>
    </main>
  );
}
