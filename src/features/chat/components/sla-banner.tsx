"use client";

import { AlarmClock, ChevronDown, Headset, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SlaAlertView } from "@/contracts/chat";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "nexo:sla-dispensados";

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Aviso proativo: o funcionário abre o chat e já vê se um chamado dele venceu ou está
 * para vencer, com a conta do prazo ("por quê?") e o atalho para chamar um analista.
 */
export function SlaBanner({ disabled, onAskAnalyst }: { disabled: boolean; onAskAnalyst: (alert: SlaAlertView) => void }) {
  const [alerts, setAlerts] = useState<SlaAlertView[]>([]);
  // Leitura preguiçosa: no servidor não há sessionStorage, mas lá o aviso ainda não aparece (alerts começa vazio).
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ alerts: SlaAlertView[] }>("/api/chat/sla")
      .then((body) => setAlerts(body.alerts))
      .catch(() => setAlerts([])); // sem o aviso, o chat segue normal
  }, []);

  const dismiss = (code: string) => {
    const next = [...dismissed, code];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // navegação privada: o aviso só volta ao recarregar
    }
  };

  const visible = alerts.filter((a) => !dismissed.includes(a.code)).slice(0, 2);
  if (!visible.length) return null;

  return (
    <section aria-label="Prazos dos seus chamados" className="space-y-2.5">
      {visible.map((alert) => {
        const overdue = alert.level === "overdue";
        return (
          <div
            key={alert.code}
            className={cn("rounded-2xl p-3.5 text-sm", overdue ? "bg-danger-soft/70 shadow-[0_0_0_1px_oklch(0.6_0.21_27/0.14)]" : "bg-warning-soft/80 shadow-[0_0_0_1px_oklch(0.72_0.17_60/0.18)]")}
          >
            <div className="flex items-start gap-3">
              <span className={cn("mt-px grid size-7 shrink-0 place-items-center rounded-full bg-surface", overdue ? "text-danger-foreground" : "text-warning-foreground")}>
                <AlarmClock className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{alert.headline}</p>
                <p className="text-xs text-muted-foreground">{alert.title}</p>
              </div>
              <Button size="icon-xs" variant="ghost" aria-label={`Dispensar aviso do ${alert.code}`} onClick={() => dismiss(alert.code)}>
                <X />
              </Button>
            </div>
            {open === alert.code && (
              <ul className="mt-3 ml-10 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground marker:text-border">
                {alert.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 ml-10 flex flex-wrap items-center gap-2">
              <Button size="xs" variant="outline" disabled={disabled} onClick={() => onAskAnalyst(alert)}>
                <Headset /> Falar com um analista
              </Button>
              <Button size="xs" variant="beam" aria-expanded={open === alert.code} onClick={() => setOpen(open === alert.code ? null : alert.code)}>
                por quê? <ChevronDown className={cn("transition-transform duration-150", open === alert.code && "rotate-180")} />
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
