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
}

export function checkScenario(expect: Scenario["expect"], outcome: ScenarioOutcome): string[] {
  const tools = new Set(outcome.toolsUsed);
  const failures: string[] = [];
  if (expect.intent && !expect.intent.includes(outcome.lastIntent as never)) failures.push(`intenção ${outcome.lastIntent}`);
  if (expect.anyTool && !expect.anyTool.some((t) => tools.has(t))) failures.push(`esperava ${expect.anyTool.join(" ou ")}`);
  for (const tool of expect.noTool ?? []) if (tools.has(tool)) failures.push(`não devia usar ${tool}`);
  if (expect.handedOff && outcome.finalStatus === "with_agent") failures.push("não transferiu");
  if (expect.handedOff === false && outcome.finalStatus !== "with_agent") failures.push("transferiu sem precisar");
  for (const term of expect.replyExcludes ?? []) {
    if (outcome.replies.some((r) => r.toLowerCase().includes(term.toLowerCase()))) failures.push(`vazou "${term}"`);
  }
  return failures;
}
