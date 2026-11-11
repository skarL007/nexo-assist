import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/nexo/brand";

/** Página de aviso (acesso restrito, 404, erro), no visual do app: faixa de marca em cima, aviso embaixo. */
export function StatusPage({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-28px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b bg-ink/60 px-6 py-4 sm:px-8">
          <Brand inverted />
        </div>
        <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-9">
          <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="space-y-2.5">
            <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-3xl">{title}</h1>
            <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">{children}</p>
          </div>
          {action && <div className="flex [&>*]:max-sm:h-11 [&>*]:max-sm:w-full">{action}</div>}
        </div>
      </div>
    </main>
  );
}
