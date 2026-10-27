/**
 * Histórico da conversa no formato que o modelo recebe.
 *
 * Cards não vão inteiros (gastaria tokens): viram uma nota curta do sistema entre ⟦ ⟧.
 * O modelo às vezes imita essas notas na resposta, então `stripSystemNotes`
 * limpa o texto antes de salvar e antes de reenviar ao modelo.
 */
import type { Card, ChatMessage } from "@/domain/message";

/** Mensagens longas do histórico são cortadas antes de ir ao modelo. */
export const HISTORY_MESSAGE_MAX_CHARS = 1500;

const SYSTEM_NOTE = /\s*⟦[^⟧]*⟧/g;
// Formato antigo das notas (entre colchetes), que o modelo aprendeu a copiar.
const LEGACY_NOTE = /\s*\[(?:opções:|card [A-Z]+-\d+|lista para escolher:|rascunho D-\d+)[^\]]*\]/g;

export function stripSystemNotes(text: string): string {
  return text.replace(SYSTEM_NOTE, "").replace(LEGACY_NOTE, "").trim();
}

// O chat mostra texto puro: markdown do modelo apareceria como "**INC-20150**".
const EMPHASIS = /\*\*(\S(?:[^*]*\S)?)\*\*|__(\S(?:[^_]*\S)?)__/g;
const HEADING = /^#{1,6}\s+/gm;

export function stripMarkdown(text: string): string {
  return text.replace(EMPHASIS, (_, bold, underline) => bold ?? underline).replace(HEADING, "");
}

export function toModelMessages(history: ChatMessage[]) {
  return history.map((message) => {
    const text = stripSystemNotes(message.text).slice(0, HISTORY_MESSAGE_MAX_CHARS);
    if (message.role === "employee") return { role: "user" as const, content: text };
    const prefix = message.role === "analyst" ? `[Analista ${message.authorName}] ` : message.role === "system" ? "[Sistema] " : "";
    const notes = message.cards.map(describeCard).filter(Boolean).join(" ");
    return { role: "assistant" as const, content: `${prefix}${text} ${notes}`.trim() };
  });
}

function describeCard(card: Card): string {
  switch (card.kind) {
    case "ticket":
      return note(`card do chamado ${card.ticket.code} exibido (${card.ticket.title}, ${card.ticket.status}${card.ticket.overdue ? ", vencido" : ""})`);
    case "ticket_choice":
      return note(`lista para escolher exibida: ${card.tickets.map((t) => `${t.code} ${t.title}`).join("; ")}`);
    case "draft":
      return note(`rascunho D-${card.draft.id} exibido para confirmação`);
    case "quick_replies":
      return note(`botões de resposta rápida exibidos: ${card.options.join(" / ")}`);
    case "handoff":
      return "";
  }
}

const note = (text: string) => `⟦sistema: ${text}⟧`;
