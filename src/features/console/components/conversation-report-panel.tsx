"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConsoleConversationDetail } from "@/contracts/chat";
import { percent } from "@/lib/format";
import { countsLine, frustrationLine, handoffLine, pendingLine, reportAsText, reportOf, ticketLine } from "@/lib/report-text";

/** Relatório da conversa no topo do histórico: o analista entende o caso sem ler tudo. */
export function ConversationReportPanel({ conversation, onClose }: { conversation: ConsoleConversationDetail; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLElement>(null);
  // O histórico abre rolado para o fim; o relatório fica no topo, então leva a tela até ele.
  // Chaves no corpo: no Chrome novo, scrollIntoView devolve uma Promise, e o React trataria como limpeza.
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "start" });
  }, []);
  const report = useMemo(() => reportOf(conversation), [conversation]);

  const copy = async () => {
    await navigator.clipboard.writeText(reportAsText(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section ref={panel} aria-label="Relatório da conversa" className="rounded-xl border bg-surface p-5 text-sm shadow-xs">
      <header className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold tracking-tight">Relatório da conversa</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{countsLine(report)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Fechar relatório" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="space-y-4 border-t pt-4">
        {report.need && (
          <div>
            <p className="eyebrow mb-1">Precisa</p>
            <p className="font-serif text-[17px] leading-snug tracking-tight">{report.need}</p>
          </div>
        )}
        {report.handoff && <p className="text-xs text-warning-foreground">{handoffLine(report.handoff)}</p>}
        <Section title="O agent já fez" items={report.actions} />
        <Section title="Artigos da central de ajuda" items={report.articles} />
        <Section title="Falhas" items={report.failures} tone="text-danger-foreground" />
        <Section title="Chamados citados" items={report.tickets.map(ticketLine)} />
        <Section title="Pendências" items={report.pending.map((item) => pendingLine(item, report.employee.name))} tone="text-warning-foreground" />
        {report.frustration && <p className="text-xs font-medium text-danger-foreground">{frustrationLine(report.frustration)}</p>}
        {report.lowestConfidence !== null && <p className="text-xs text-muted-foreground">Menor confiança do agent: {percent(report.lowestConfidence)}</p>}
      </div>
    </section>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="eyebrow mb-1">{title}</p>
      <ul className={`list-disc space-y-1 pl-5 ${tone ?? ""}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
