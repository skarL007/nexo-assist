"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot, type Tone } from "@/components/nexo/status-pill";
import type { DraftSnapshot, DraftStatus } from "@/domain/message";
import { CATEGORY_LABEL, IMPACT_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL } from "@/domain/ticket";
import { formatClock, formatDayTime } from "@/lib/format";
import { CardShell, Field } from "./card-shell";

const STATUS: Record<DraftStatus, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Aguardando confirmação" },
  confirmed: { tone: "success", label: "Confirmado" },
  cancelled: { tone: "neutral", label: "Descartado" },
};

const PRIORITY_TONE = { critical: "danger", high: "warning", medium: "info", low: "neutral" } as const;

export interface DraftActions {
  onConfirm: () => Promise<unknown>;
  onCancel: () => Promise<unknown>;
  onEdit: () => void;
}

/** Rascunho de chamado: nada é criado até o funcionário clicar em Confirmar. */
export function DraftCard({ draft, status, actions }: { draft: DraftSnapshot; status: DraftStatus; actions?: DraftActions }) {
  const [busy, setBusy] = useState(false);
  const pending = status === "pending" && !!actions;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  // Ctrl/⌘ + Enter confirma o rascunho mais recente, como no protótipo.
  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void run(actions.onConfirm);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, actions]);

  const footer = pending ? (
    <>
      <Button size="sm" disabled={busy} onClick={() => run(actions.onConfirm)}>
        Confirmar <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Ctrl ↵</kbd>
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={actions.onEdit}>
        Editar
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(actions.onCancel)}>
        Cancelar
      </Button>
    </>
  ) : undefined;

  const badge = <StatusDot tone={STATUS[status].tone}>{STATUS[status].label}</StatusDot>;

  if (draft.kind === "update") {
    const { fields } = draft;
    return (
      <CardShell
        eyebrow={`Atualização · Rascunho D-${draft.id}`}
        status={badge}
        title={`${fields.ticketCode} · ${fields.ticketTitle}`}
        description={fields.comment}
        footer={footer}
      >
        <Field label="Chamado">{fields.ticketCode}</Field>
        <Field label="Efeito">{fields.reopen ? "Reabre o chamado" : "Adiciona comentário"}</Field>
      </CardShell>
    );
  }

  const { fields } = draft;
  return (
    <CardShell
      eyebrow={`Novo chamado · Rascunho D-${draft.id}`}
      status={badge}
      title={fields.title}
      description={fields.description}
      footer={footer}
    >
      <Field label="Tipo">{TICKET_TYPE_LABEL[fields.type]}</Field>
      <Field label="Categoria">{CATEGORY_LABEL[fields.category]}</Field>
      <Field label="Prioridade">
        <span title={`${fields.priorityReason} · resposta até ${formatDayTime(draft.deadline)}`}>
          <StatusDot tone={PRIORITY_TONE[fields.priority]} className="text-sm text-foreground">
            {PRIORITY_LABEL[fields.priority]}
            <span className="font-normal text-muted-foreground">· resposta até {formatClock(draft.deadline)}</span>
          </StatusDot>
        </span>
      </Field>
      <Field label="Afetados">{IMPACT_LABEL[fields.impact]}</Field>
    </CardShell>
  );
}
