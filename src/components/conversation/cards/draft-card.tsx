"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot, StatusPill, type Tone } from "@/components/nexo/status-pill";
import type { DraftSnapshot, DraftStatus } from "@/domain/message";
import { CATEGORY_LABEL, IMPACT_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL } from "@/domain/ticket";
import { formatDayTime, formatDeadline } from "@/lib/format";
import { messageOf } from "@/lib/api-client";
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
  /** O Farol está respondendo: a resposta usa os rascunhos de antes, então confirmar agora a deixaria desatualizada. */
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
      {/* Card estreito (celular, tablet): o Confirmar ocupa a linha toda e os outros dois dividem a de baixo. O atalho só aparece onde há teclado. */}
      <Button size="sm" className="h-10 basis-full @md:h-8 @md:basis-auto" disabled={disabled} onClick={() => run(actions.onConfirm)}>
        Confirmar{" "}
        {actions.shortcut && (
          <kbd className="ml-1 hidden rounded-[5px] border border-primary-foreground/35 px-1.5 py-px font-sans text-[10px] leading-4 font-medium @md:inline-block pointer-coarse:hidden!">
            Ctrl ↵
          </kbd>
        )}
      </Button>
      <Button size="sm" variant="outline" className="h-10 flex-1 @md:h-8 @md:flex-none" disabled={disabled} onClick={() => setEditing(true)}>
        Alterar detalhes
      </Button>
      <Button size="sm" variant="ghost" className="h-10 flex-1 @md:ml-auto @md:h-8 @md:flex-none" disabled={disabled} onClick={() => run(actions.onCancel)}>
        Cancelar
      </Button>
      {actions.locked && <span className="basis-full text-xs text-muted-foreground">Aguarde o Farol responder para confirmar.</span>}
      {error && (
        <span role="alert" className="basis-full text-xs text-danger-foreground">
          {error}
        </span>
      )}
    </>
  ) : undefined;

  const badge = (
    <StatusDot tone={STATUS[status].tone} className="whitespace-nowrap">
      {STATUS[status].label}
    </StatusDot>
  );
  // Rascunho que já não vale (substituído ou descartado) fica apagado, para o atual se destacar.
  const stale = status === "replaced" || status === "cancelled";

  if (draft.kind === "update") {
    const { fields } = draft;
    return (
      <div data-testid="draft-card">
        <CardShell
          eyebrow={`Atualização · Rascunho D-${draft.id}`}
          status={badge}
          title={`${fields.ticketCode} · ${fields.ticketTitle}`}
          description={fields.comment}
          footer={footer}
          muted={stale}
        >
          <Field label="Chamado">
            <span className="font-mono text-[13px]">{fields.ticketCode}</span>
          </Field>
          <Field label="Efeito" wrap className="@md:col-span-3">
            {fields.reopen ? "Reabre o chamado" : "Adiciona comentário"}
          </Field>
        </CardShell>
      </div>
    );
  }

  const { fields } = draft;
  return (
    <div data-testid="draft-card">
      <CardShell
        eyebrow={`Novo chamado · Rascunho D-${draft.id}`}
        status={badge}
        title={fields.title}
        description={fields.description}
        footer={footer}
        muted={stale}
      >
        <Field label="Tipo">{TICKET_TYPE_LABEL[fields.type]}</Field>
        <Field label="Categoria">{CATEGORY_LABEL[fields.category]}</Field>
        <Field label="Prioridade" wrap>
          <span title={`${fields.priorityReason} · resposta até ${formatDayTime(draft.deadline)}`} className="flex flex-col items-start gap-1">
            <StatusPill tone={PRIORITY_TONE[fields.priority]}>{PRIORITY_LABEL[fields.priority]}</StatusPill>
            {status === "pending" && (
              <span className="text-xs font-normal whitespace-normal text-muted-foreground">
                resposta até <span className="whitespace-nowrap tabular-nums">{formatDeadline(draft.deadline)}</span>
              </span>
            )}
          </span>
        </Field>
        <Field label="Afetados">{IMPACT_LABEL[fields.impact]}</Field>
      </CardShell>
    </div>
  );
}
