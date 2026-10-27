import { Lock } from "lucide-react";
import { Brand } from "@/components/nexo/brand";

/** Mostrada pelo proxy quando falta o token de acesso do deploy. */
export default function RestrictedAccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-surface p-8 text-center shadow-xs">
        <div className="flex justify-center">
          <Brand />
        </div>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Esta demonstração usa um modelo de IA pago. Abra pelo link de acesso que você recebeu.
          </p>
        </div>
      </div>
    </main>
  );
}
