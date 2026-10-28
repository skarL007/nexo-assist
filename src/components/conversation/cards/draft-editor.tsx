"use client";

import { useState } from "react";
import { StatusDot } from "@/components/nexo/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describeChanges, DRAFT_LIMITS, reviseNewTicket, urgencyOf, type NewTicketEdit } from "@/domain/draft-revision";
import type { DraftSnapshot } from "@/domain/message";
import { SLA_LABEL, slaDeadline, URGENCIES, URGENCY_LABEL } from "@/domain/priority";
import { CATEGORIES, CATEGORY_LABEL, IMPACTS, IMPACT_LABEL, PRIORITY_LABEL, TICKET_TYPES, TICKET_TYPE_LABEL } from "@/domain/ticket";
import { formatDeadline } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DraftEditFields = NewTicketEdit | { comment: string };

export const PRIORITY_TONE = { critical: "danger", high: "warning", medium: "info", low: "neutral" } as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((value) => ({ value, label: capitalize(labels[value]) }));

interface EditorProps {
  /** O Nexo está respondendo: salvar fica para depois, como o Confirmar. */
  locked: boolean;
  onSave: (fields: DraftEditFields) => Promise<unknown>;
  onClose: () => void;
}

/**
 * "Alterar detalhes" no próprio card. A prévia (prioridade, prazo e o que muda) usa as
 * mesmas regras do domínio que o servidor; quem decide de verdade é o servidor ao salvar.
 */
export function DraftEditor({ draft, ...props }: EditorProps & { draft: DraftSnapshot }) {
  return draft.kind === "create" ? <NewTicketEditor draft={draft} {...props} /> : <CommentEditor draft={draft} {...props} />;
}

function NewTicketEditor({ draft, locked, onSave, onClose }: EditorProps & { draft: Extract<DraftSnapshot, { kind: "create" }> }) {
  const current = draft.fields;
  const [edit, setEdit] = useState<NewTicketEdit>({
    type: current.type,
    category: current.category,
    title: current.title,
    description: current.description,
    impact: current.impact,
    urgency: urgencyOf(current),
  });
  const set = <K extends keyof NewTicketEdit>(key: K) => (value: NewTicketEdit[K]) => setEdit((before) => ({ ...before, [key]: value }));

  const { fields: next, changes } = reviseNewTicket(current, edit);
  const titleOk = between(edit.title, DRAFT_LIMITS.title);
  const descriptionOk = between(edit.description, DRAFT_LIMITS.description);
  const deadline = slaDeadline(next.priority, new Date()).toISOString();

  return (
    <EditorShell
      eyebrow={`Novo chamado · Rascunho D-${draft.id} · alterando`}
      canSave={changes.length > 0 && titleOk && descriptionOk}
      locked={locked}
      onSave={() => onSave(edit)}
      onClose={onClose}
    >
      <TextField id={`d${draft.id}-title`} label="Título" value={edit.title} onChange={set("title")} limits={DRAFT_LIMITS.title} invalid={!titleOk} />
      <TextField
        id={`d${draft.id}-description`}
        label="Descrição"
        value={edit.description}
        onChange={set("description")}
        limits={DRAFT_LIMITS.description}
        invalid={!descriptionOk}
        multiline
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceGroup label="Tipo" value={edit.type} options={options(TICKET_TYPES, TICKET_TYPE_LABEL)} onChange={set("type")} />
        <ChoiceGroup label="Afetados" value={edit.impact} options={options(IMPACTS, IMPACT_LABEL)} onChange={set("impact")} />
      </div>
      <ChoiceGroup label="Categoria" value={edit.category} options={options(CATEGORIES, CATEGORY_LABEL)} onChange={set("category")} />
      <ChoiceGroup label="Urgência" value={edit.urgency} options={options(URGENCIES, URGENCY_LABEL)} onChange={set("urgency")} />

      <div data-testid="draft-preview" aria-live="polite" className="space-y-1 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-xs text-muted-foreground">Prioridade</span>
          <StatusDot tone={PRIORITY_TONE[next.priority]} className="text-sm text-foreground">
            {PRIORITY_LABEL[next.priority]}
          </StatusDot>
          <span className="text-xs text-muted-foreground">
            · {SLA_LABEL[next.priority]}, resposta até {formatDeadline(deadline)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{next.priorityReason}</p>
        {next.priority === "critical" && <p className="text-xs text-danger">Crítico: ao confirmar, um analista é chamado na hora.</p>}
        <p className="text-xs">
          <span className="font-medium">O que muda: </span>
          {changes.length ? describeChanges(changes) : <span className="text-muted-foreground">nada ainda.</span>}
        </p>
      </div>
    </EditorShell>
  );
}

function CommentEditor({ draft, locked, onSave, onClose }: EditorProps & { draft: Extract<DraftSnapshot, { kind: "update" }> }) {
  const [comment, setComment] = useState(draft.fields.comment);
  const ok = between(comment, DRAFT_LIMITS.comment);
  return (
    <EditorShell
      eyebrow={`Atualização · Rascunho D-${draft.id} · alterando`}
      canSave={ok && comment.trim() !== draft.fields.comment}
      locked={locked}
      onSave={() => onSave({ comment })}
      onClose={onClose}
    >
      <p className="text-sm font-semibold">
        {draft.fields.ticketCode} · {draft.fields.ticketTitle}
      </p>
      <TextField
        id={`d${draft.id}-comment`}
        label={draft.fields.reopen ? "Comentário (o chamado será reaberto)" : "Comentário para o analista"}
        value={comment}
        onChange={setComment}
        limits={DRAFT_LIMITS.comment}
        invalid={!ok}
        multiline
      />
    </EditorShell>
  );
}

function EditorShell({
  eyebrow,
  canSave,
  locked,
  onSave,
  onClose,
  children,
}: {
  eyebrow: string;
  canSave: boolean;
  locked: boolean;
  onSave: () => Promise<unknown>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar. Tente de novo.");
      setBusy(false);
    }
  };

  return (
    <div data-testid="draft-card" className="overflow-hidden rounded-xl border border-primary/40 bg-surface shadow-xs">
      <div className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">{eyebrow}</p>
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-4 py-3">
        <Button size="sm" disabled={!canSave || busy || locked} onClick={save}>
          Salvar alterações
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Voltar
        </Button>
        {locked && <span className="text-xs text-muted-foreground">Aguarde o Nexo responder para salvar.</span>}
        {error && (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  limits: [min, max],
  invalid,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  limits: readonly [number, number];
  invalid: boolean;
  multiline?: boolean;
}) {
  const Control = multiline ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
          {label}
        </Label>
        <span className={cn("text-[11px] tabular-nums", invalid ? "text-danger" : "text-muted-foreground")}>
          {invalid && value.trim().length < min ? `mínimo ${min}` : `${value.trim().length}/${max}`}
        </span>
      </div>
      <Control id={id} value={value} maxLength={max} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/** Opções em pílulas (role radio): um toque troca o valor e a prévia acompanha. */
function ChoiceGroup<T extends string>({
  label,
  value,
  options: choices,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(choice.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted",
              )}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const between = (text: string, [min, max]: readonly [number, number]) => {
  const length = text.trim().length;
  return length >= min && length <= max;
};
