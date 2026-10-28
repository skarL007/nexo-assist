/**
 * Checagens determinísticas de um cenário: as mesmas regras para `npm run eval`
 * e para o benchmark de modelos. Recebe o que aconteceu e devolve o que falhou.
 */
import type { Scenario } from "./scenarios";

export interface ScenarioOutcome {
  /** Intenção registrada no último turno. */
  lastIntent: string | undefined;
  toolsUsed: Iterable<string>;
  /** Status da conversa no fim (ex.: "with_agent", "waiting_analyst"). */
  finalStatus: string;
  replies: string[];
  /** Chamados criados ou alterados durante o cenário (o runner compara antes e depois). */
  ticketChanges?: number;
  /** Prioridade de cada rascunho de chamado novo que o agent montou. */
  draftPriorities?: string[];
  /** Impacto de cada rascunho de chamado novo (incidente em massa sobe para "team"). */
  draftImpacts?: string[];
  /** Frustração registrada no último entendimento. */
  lastFrustration?: string;
  /** Opções de resposta rápida mostradas em algum turno. */
  quickReplies?: string[];
  /** Categoria de cada rascunho de chamado novo. */
  draftCategories?: string[];
  /** Chamado de cada rascunho de atualização. */
  updateDraftCodes?: string[];
}

/** Convite a falar com um analista no texto ("posso chamar um analista", "quer falar com um analista?"). */
export const ANALYST_INVITE = /(falar|chamar|transferir|conversar|acionar|encaminhar)[^.?!]{0,30}analista/i;

export function checkScenario(expect: Scenario["expect"], outcome: ScenarioOutcome): string[] {
  const tools = new Set(outcome.toolsUsed);
  const failures: string[] = [];
  if (expect.intent && !expect.intent.includes(outcome.lastIntent as never)) failures.push(`intenção ${outcome.lastIntent}`);
  if (expect.anyTool && !expect.anyTool.some((t) => tools.has(t))) failures.push(`esperava ${expect.anyTool.join(" ou ")}`);
  for (const tool of expect.noTool ?? []) if (tools.has(tool)) failures.push(`não devia usar ${tool}`);
  if (expect.handedOff && outcome.finalStatus === "with_agent") failures.push("não transferiu");
  if (expect.handedOff === false && outcome.finalStatus !== "with_agent") failures.push("transferiu sem precisar");
  for (const term of expect.replyIncludes ?? []) {
    if (!outcome.replies.some((r) => r.toLowerCase().includes(term.toLowerCase()))) failures.push(`faltou "${term}"`);
  }
  for (const term of expect.replyExcludes ?? []) {
    if (outcome.replies.some((r) => r.toLowerCase().includes(term.toLowerCase()))) failures.push(`vazou "${term}"`);
  }
  if (expect.noTicketChanges) {
    if (outcome.ticketChanges === undefined) failures.push("sem dados de chamados para checar");
    else if (outcome.ticketChanges > 0) failures.push(`mudou ${outcome.ticketChanges} chamado${outcome.ticketChanges > 1 ? "s" : ""}`);
  }
  if (expect.draftPriorityNot) {
    if (outcome.draftPriorities === undefined) failures.push("sem dados de rascunhos para checar");
    for (const priority of outcome.draftPriorities ?? []) if (expect.draftPriorityNot.includes(priority as never)) failures.push(`rascunho com prioridade ${priority}`);
  }
  if (expect.frustration && (outcome.lastFrustration ?? "none") !== expect.frustration) failures.push(`frustração ${outcome.lastFrustration ?? "none"}`);
  if (expect.offersAnalyst) {
    const inText = outcome.replies.some((r) => /analista/i.test(r));
    const inButton = (outcome.quickReplies ?? []).some((o) => /analista/i.test(o));
    if (!inText && !inButton) failures.push("não ofereceu analista");
  }
  if (expect.noAnalystOffer) {
    const inButton = (outcome.quickReplies ?? []).some((o) => /analista/i.test(o));
    if (inButton || outcome.replies.some((r) => ANALYST_INVITE.test(r))) failures.push("ofereceu analista sem precisar");
  }
  if (expect.draftCategory) {
    if (!outcome.draftCategories?.length) failures.push("nenhum rascunho de chamado novo");
    else if (!outcome.draftCategories.every((c) => c === expect.draftCategory)) failures.push(`rascunho com categoria ${outcome.draftCategories.join("/")}`);
  }
  for (const code of expect.noUpdateDraftFor ?? []) {
    if (outcome.updateDraftCodes?.includes(code)) failures.push(`rascunho de atualização no ${code}`);
  }
  if (expect.draftImpact) {
    if (!outcome.draftImpacts?.length) failures.push("nenhum rascunho de chamado novo");
    else if (!outcome.draftImpacts.every((impact) => impact === expect.draftImpact)) failures.push(`rascunho com impacto ${outcome.draftImpacts.join("/")}`);
  }
  return failures;
}
