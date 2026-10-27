/**
 * Transforma uma conversa gravada em texto para o juiz ler: o que o funcionário
 * escreveu, o que o agent fez (tools e cards) e o que respondeu. O juiz não sabe
 * qual modelo gerou a conversa (avaliação cega).
 */
import type { Card } from "@/domain/message";
import type { ConversationRecord } from "./records";

/** Cards em uma linha, com os dados que o funcionário vê na tela. */
export function describeCard(card: Card): string {
  switch (card.kind) {
    case "ticket": {
      const t = card.ticket;
      return `[card do chamado ${t.code}: "${t.title}" · ${t.status} · prioridade ${t.priority}${t.deadline ? ` · prazo ${t.deadline}` : ""}${t.overdue ? " · VENCIDO" : ""}]`;
    }
    case "ticket_choice":
      return `[lista para escolher: ${card.tickets.map((t) => `${t.code} "${t.title}" (${t.status})`).join("; ")}]`;
    case "draft":
      return card.draft.kind === "create"
        ? `[rascunho de chamado para confirmar: "${card.draft.fields.title}" · ${card.draft.fields.category} · prioridade ${card.draft.fields.priority}]`
        : `[rascunho de atualização do ${card.draft.fields.ticketCode} para confirmar: "${card.draft.fields.comment}"${card.draft.fields.reopen ? " · reabre" : ""}]`;
    case "quick_replies":
      return `[botões: ${card.options.join(" | ")}]`;
    case "handoff":
      return `[transferido para um analista: ${card.summary}]`;
  }
}

export function formatTranscript(conversation: ConversationRecord): string {
  const lines = [`Funcionário logado: ${conversation.employeeName}.`, ""];
  for (const turn of conversation.turns) {
    lines.push(`FUNCIONÁRIO: ${turn.text}`);
    const d = turn.decision;
    lines.push(
      d
        ? `  (registro de entendimento, visível no painel "por quê?": intenção ${d.intent} · confiança ${d.confidence.toFixed(2)} · entendeu: "${d.understanding}" · motivo: "${d.reasoning}")`
        : "  (o agent NÃO registrou o entendimento neste turno)",
    );
    const actions = turn.toolCalls.filter((c) => c.tool !== "recordUnderstanding");
    if (actions.length) {
      lines.push("  (ações do agent, invisíveis para o funcionário)");
      for (const call of actions) lines.push(`  - ${call.tool}(${call.input}) → ${call.output}`);
    }
    if (turn.guardrails.length) lines.push(`  (regras do sistema que agiram: ${turn.guardrails.join("; ")})`);
    if (turn.error) lines.push(`  (erro técnico no turno: ${turn.error})`);
    lines.push(`AGENT: ${turn.reply || "(sem resposta)"}`);
    for (const card of turn.cards) lines.push(`  ${card}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
