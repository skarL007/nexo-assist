/**
 * Verificações de diagnóstico da central de ajuda (formato KCS): o que o funcionário
 * pode conferir sozinho antes de virar chamado. O modelo só informa o id e o resultado
 * de cada verificação; o texto que vai ao chamado sai do artigo, então o analista nunca
 * recebe uma verificação que não existe na central.
 */
import type { Article } from "./knowledge";

export interface DiagnosticCheck {
  /** Estável entre versões do artigo (ex.: "energia-cabo"). */
  id: string;
  /** O que conferir, como afirmação ("Cabo de energia encaixado..."). */
  label: string;
  /** O que fazer quando não está em ordem. */
  fix: string;
}

export const CHECK_RESULTS = ["ok", "adjusted", "not_done"] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const CHECK_RESULT_LABEL: Record<CheckResult, string> = {
  ok: "em ordem",
  adjusted: "ajustado, sem resolver",
  not_done: "não conseguiu verificar",
};

export interface CheckDone {
  checkId: string;
  result: CheckResult;
}

/** Botões de cada verificação. "Resolveu" encerra sem chamado e não entra no "já tentado". */
export const CHECK_OPTIONS = ["Já estava assim", "Ajustei, mas continua", "Resolveu", "Não consigo verificar"] as const;
const RESULT_BY_OPTION = new Map<string, CheckResult>([
  ["ja estava assim", "ok"],
  ["ajustei, mas continua", "adjusted"],
  ["nao consigo verificar", "not_done"],
]);

/** Acima disto, o agent segue para o chamado em vez de pedir mais uma verificação. */
export const MAX_CHECKS = 3;

type HistoryMessage = { role: string; text: string; trace: { toolCalls: { tool: string; input: unknown }[] } | null };

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Id da verificação que o agent pediu nesta mensagem (pela tool, não pelo texto). */
function askedCheck(message: HistoryMessage): string | null {
  if (message.role !== "agent") return null;
  const call = message.trace?.toolCalls.findLast((c) => c.tool === "askDiagnosticCheck");
  const checkId = (call?.input as { checkId?: unknown } | undefined)?.checkId;
  return typeof checkId === "string" ? checkId : null;
}

export function checksAsked(history: HistoryMessage[]): number {
  return history.filter((m) => askedCheck(m) !== null).length;
}

/**
 * O "já tentado" sai do histórico: verificação pedida pela tool + botão que o funcionário
 * clicou logo depois. Resposta livre fica de fora (não dá para saber o resultado com certeza).
 */
export function checksFromHistory(history: HistoryMessage[]): CheckDone[] {
  return history.flatMap((message, index) => {
    const checkId = askedCheck(message);
    if (!checkId) return [];
    const answer = history.slice(index + 1).find((m) => m.role === "employee");
    const result = answer ? RESULT_BY_OPTION.get(normalize(answer.text)) : undefined;
    return result ? [{ checkId, result }] : [];
  });
}

export function describeChecksDone(articles: Article[], done: CheckDone[]): { text: string | null; unknown: string[] } {
  const known = new Map(articles.flatMap((a) => a.checks ?? []).map((c) => [c.id, c]));
  const results = new Map<string, CheckResult>();
  const unknown: string[] = [];
  for (const { checkId, result } of done) {
    if (!known.has(checkId)) {
      if (!unknown.includes(checkId)) unknown.push(checkId);
      continue;
    }
    results.delete(checkId); // a última resposta vale e fica na ordem em que foi dada
    results.set(checkId, result);
  }
  if (results.size === 0) return { text: null, unknown };
  const lines = [...results].map(([id, result]) => `- ${known.get(id)!.label}: ${CHECK_RESULT_LABEL[result]}`);
  return { text: ["Verificações já feitas com o funcionário:", ...lines].join("\n"), unknown };
}
