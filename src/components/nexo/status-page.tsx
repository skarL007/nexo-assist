import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/nexo/brand";

/** Página de aviso centralizada (acesso restrito, 404, erro), no visual do app. */
export function StatusPage({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-surface p-8 text-center shadow-xs">
        <div className="flex justify-center">
          <Brand />
        </div>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
        {action}
      </div>
    </main>
  );
}
