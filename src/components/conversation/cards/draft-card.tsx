"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot, type Tone } from "@/components/nexo/status-pill";
import type { DraftSnapshot, DraftStatus } from "@/domain/message";
import { CATEGORY_LABEL, IMPACT_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL } from "@/domain/ticket";
import { formatDayTime, formatDeadline } from "@/lib/format";
import { messageOf } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CardShell, Field } from "./card-shell";
import { DraftEditor, PRIORITY_TONE, type DraftEditFields } from "./draft-editor";

const STATUS: Record<DraftStatus, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Aguardando confirmação" },
  confirmed: { tone: "success", label: "Confirmado" },
  cancelled: { tone: "neutral", label: "Descartado" },
  replaced: { tone: "neutral", label: "Substituído" },
};

export interface DraftActions {
  onConfirm: () => Promise<unknown>;
  onCancel: () => Promise<unknown>;
  /** "Alterar detalhes": salva pelo card; o servidor troca o rascunho por um novo. */
  onSave: (fields: DraftEditFields) => Promise<unknown>;
  /** Só o rascunho pendente mais recente atende ao Ctrl/⌘ + Enter. */
  shortcut?: boolean;
  /** O Nexo está respondendo: a resposta usa os rascunhos de antes, então confirmar agora a deixaria desatualizada. */
  locked?: boolean;
}

/** Rascunho de chamado: nada é criado até o funcionário clicar em Confirmar. */
export function DraftCard({ draft, status, actions }: { draft: DraftSnapshot; status: DraftStatus; actions?: DraftActions }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = status === "pending" && !!actions;
  const disabled = busy || !!actions?.locked;

  // O erro aparece no próprio card: criar o chamado passa pelo sistema legado, que às vezes cai.
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (failure) {
      setError(messageOf(failure, "Não foi possível concluir. Tente de novo."));
    } finally {
      setBusy(false);
    }
  };

  // Ctrl/⌘ + Enter confirma o rascunho mais recente, como no protótipo (não enquanto ele é alterado).
  useEffect(() => {
    if (!pending || editing || !actions.shortcut || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void run(actions.onConfirm);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, editing, actions, disabled]);

  if (pending && editing) {
    return <DraftEditor draft={draft} locked={!!actions.locked} onSave={actions.onSave} onClose={() => setEditing(false)} />;
  }

  const footer = pending ? (
    <>
      <Button size="sm" disabled={disabled} onClick={() => run(actions.onConfirm)}>
        Confirmar {actions.shortcut && <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Ctrl ↵</kbd>}
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => setEditing(true)}>
        Alterar detalhes
      </Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => run(actions.onCancel)}>
        Cancelar
      </Button>
      {actions.locked && <span className="text-xs text-muted-foreground">Aguarde o Nexo responder para confirmar.</span>}
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </>
  ) : undefined;

  const badge = <StatusDot tone={STATUS[status].tone}>{STATUS[status].label}</StatusDot>;
  // Rascunho que já não vale (substituído ou descartado) fica apagado, para o atual se destacar.
  const stale = status === "replaced" || status === "cancelled";

  if (draft.kind === "update") {
    const { fields } = draft;
    return (
      <div data-testid="draft-card" className={cn(stale && "opacity-60")}>
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
      </div>
    );
  }

  const { fields } = draft;
  return (
    <div data-testid="draft-card" className={cn(stale && "opacity-60")}>
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
            </StatusDot>
            {status === "pending" && (
              <span className="block text-xs font-normal whitespace-normal text-muted-foreground">resposta até {formatDeadline(draft.deadline)}</span>
            )}
          </span>
        </Field>
        <Field label="Afetados">{IMPACT_LABEL[fields.impact]}</Field>
      </CardShell>
    </div>
  );
}
