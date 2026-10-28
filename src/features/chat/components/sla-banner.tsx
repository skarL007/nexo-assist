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
    <section aria-label="Prazos dos seus chamados" className="space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.code}
          className={cn("rounded-xl border p-3 text-sm", alert.level === "overdue" ? "border-danger/30 bg-danger-soft" : "border-warning/30 bg-warning-soft")}
        >
          <div className="flex items-start gap-2">
            <AlarmClock className={cn("mt-0.5 size-4 shrink-0", alert.level === "overdue" ? "text-danger" : "text-amber-700")} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{alert.headline}</p>
              <p className="text-xs text-muted-foreground">{alert.title}</p>
            </div>
            <button type="button" aria-label={`Dispensar aviso do ${alert.code}`} className="text-muted-foreground hover:text-foreground" onClick={() => dismiss(alert.code)}>
              <X className="size-4" />
            </button>
          </div>
          {open === alert.code && (
            <ul className="mt-2 ml-6 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {alert.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 ml-6 flex flex-wrap gap-2">
            <Button size="xs" variant="outline" disabled={disabled} onClick={() => onAskAnalyst(alert)}>
              <Headset className="size-3.5" /> Falar com um analista
            </Button>
            <Button size="xs" variant="ghost" aria-expanded={open === alert.code} onClick={() => setOpen(open === alert.code ? null : alert.code)}>
              por quê? <ChevronDown className={cn("size-3.5 transition-transform", open === alert.code && "rotate-180")} />
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
