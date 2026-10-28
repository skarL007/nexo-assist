/**
 * "Alterar detalhes" de um rascunho de chamado, pelo próprio card.
 * O funcionário muda os campos; a prioridade volta a sair da matriz impacto × urgência
 * (nunca do que o navegador mandar) e a lista de mudanças vira o resumo da resposta.
 */
import type { NewTicketFields } from "./message";
import { classifyPriority, URGENCIES, URGENCY_LABEL, type Urgency } from "./priority";
import { CATEGORY_LABEL, IMPACT_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL, type Category, type Impact, type TicketType } from "./ticket";

/** Tamanho dos campos do rascunho: os mesmos que o agent respeita ao montá-lo. */
export const DRAFT_LIMITS = { title: [5, 80], description: [20, 600], comment: [5, 600] } as const;

/** O que o formulário do card deixa mudar. */
export interface NewTicketEdit {
  type: TicketType;
  category: Category;
  title: string;
  description: string;
  impact: Impact;
  urgency: Urgency;
}

export interface FieldChange {
  field: keyof NewTicketEdit | "priority";
  text: string;
}

/** Rascunhos antigos não guardavam a urgência: deduz uma que, com o impacto, dá a prioridade do rascunho. */
export function urgencyOf(fields: Omit<NewTicketFields, "urgency"> & { urgency?: Urgency }): Urgency {
  if (fields.urgency) return fields.urgency;
  return URGENCIES.find((urgency) => classifyPriority(fields.impact, urgency).priority === fields.priority) ?? "none";
}

export function reviseNewTicket(current: NewTicketFields, edit: NewTicketEdit): { fields: NewTicketFields; changes: FieldChange[] } {
  const { priority, reason } = classifyPriority(edit.impact, edit.urgency);
  // Campo a campo: nada além do formulário entra no rascunho (nem uma "prioridade" mandada pelo navegador).
  const fields: NewTicketFields = {
    type: edit.type,
    category: edit.category,
    title: edit.title.trim(),
    description: edit.description.trim(),
    impact: edit.impact,
    urgency: edit.urgency,
    priority,
    priorityReason: reason,
  };

  const changes: FieldChange[] = [];
  const from = (field: FieldChange["field"], label: string, before: string, after: string) => {
    if (before !== after) changes.push({ field, text: `${label}: ${before} → ${after}` });
  };
  if (fields.title !== current.title) changes.push({ field: "title", text: `Título: ${fields.title}` });
  if (fields.description !== current.description) changes.push({ field: "description", text: "Descrição atualizada" });
  from("type", "Tipo", TICKET_TYPE_LABEL[current.type], TICKET_TYPE_LABEL[edit.type]);
  from("category", "Categoria", CATEGORY_LABEL[current.category], CATEGORY_LABEL[edit.category]);
  from("impact", "Afetados", IMPACT_LABEL[current.impact], IMPACT_LABEL[edit.impact]);
  from("urgency", "Urgência", URGENCY_LABEL[urgencyOf(current)], URGENCY_LABEL[edit.urgency]);
  from("priority", "Prioridade", PRIORITY_LABEL[current.priority], PRIORITY_LABEL[priority]);
  return { fields, changes };
}

export const describeChanges = (changes: FieldChange[]) => changes.map((change) => change.text).join(" · ");
