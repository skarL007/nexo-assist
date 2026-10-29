/**
 * Roda a simulação do roteador em cascata sobre as conversas gravadas pelo benchmark
 * e grava docs/benchmark/roteamento.json. Imprime as tabelas usadas em ROTEAMENTO.md.
 * Não chama API nenhuma: custo zero, mesmo resultado em toda execução.
 *
 *   npm run benchmark:roteamento
 */
import { writeFileSync } from "node:fs";
import { scenarios as coreScenarios } from "../scenarios";
import { CANDIDATES } from "./config";
import { loadConversations } from "./job";
import { DEFAULT_TRIGGER, scenarioNeedsWrite, simulateCascade, single, summarizeRouting, triggerConfusion, type RoutingSummary, type Trigger } from "./routing";
import { prdScenarios } from "./scenarios-prd";

const CHEAP = "gpt-6-luna";
const STRONG = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];
const THRESHOLDS = [0.5, 0.8, 0.9, 0.95, 0.99];

const label = (key: string) => CANDIDATES.find((c) => c.key === key)?.label ?? key;
const num = (value: number, digits = 2) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number) => `${num(value * 100, 0)}%`;
const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const row = (name: string, s: RoutingSummary) => [
  name,
  `${pct(s.passRate.mean)} [${pct(s.passRate.low)}–${pct(s.passRate.high)}]`,
  pct(s.escalationRate),
  `US$ ${num(s.per1000AtendimentosUsd)}`,
  `${num(s.latency.p50 / 1000, 1)} s · ${num(s.latency.p95 / 1000, 1)} s`,
];

const needsWrite = new Map([...coreScenarios, ...prdScenarios].map((s) => [s.name, scenarioNeedsWrite(s)]));
const cheap = loadConversations(CHEAP);
const strong = Object.fromEntries(STRONG.map((key) => [key, loadConversations(key)]));

const baselines = [CHEAP, ...STRONG].map((key) => ({ name: `${label(key)} só`, summary: summarizeRouting(single(key === CHEAP ? cheap : strong[key])) }));
const cascades = STRONG.map((key) => ({ name: `${label(CHEAP)} → ${label(key)}`, summary: summarizeRouting(simulateCascade(cheap, strong[key], DEFAULT_TRIGGER)) }));

const sweep = (intents: Trigger["intents"]) =>
  THRESHOLDS.map((minConfidence) => {
    const trigger = { intents, minConfidence };
    const confusion = triggerConfusion(cheap, needsWrite, trigger, "first");
    const summary = summarizeRouting(simulateCascade(cheap, strong[STRONG[0]], trigger));
    return { minConfidence, confusion, summary };
  });
const withIntents = sweep(DEFAULT_TRIGGER.intents);
const confidenceOnly = sweep([]);

const stepZeroConfidence = cheap.map((c) => c.turns[0]?.decision?.confidence ?? 0);
const confusion = {
  first: triggerConfusion(cheap, needsWrite, DEFAULT_TRIGGER, "first"),
  any: triggerConfusion(cheap, needsWrite, DEFAULT_TRIGGER, "any"),
};

writeFileSync(
  "docs/benchmark/roteamento.json",
  `${JSON.stringify({ cheap: CHEAP, strong: STRONG, trigger: DEFAULT_TRIGGER, baselines, cascades, confusion, withIntents, confidenceOnly, stepZeroConfidence }, null, 2)}\n`,
);

const header = ["Rota", "Acerto [IC 95%]", "Subiu", "Custo por 1.000 atendimentos", "Latência p50 · p95"];
console.log(table(header, [...baselines, ...cascades].map((r) => row(r.name, r.summary))));
console.log();
console.log(
  table(
    ["Gatilho", "Risco que subiu", "Risco que ficou no barato", "Sem risco que subiu", "Sem risco no barato", "Deixou passar"],
    (["first", "any"] as const).map((mode) => {
      const c = confusion[mode];
      return [mode === "first" ? "Só o 1º turno" : "Turno a turno", `${c.tp}`, `${c.fn}`, `${c.fp}`, `${c.tn}`, c.missed.join("; ") || "—"];
    }),
  ),
);
console.log();
const sweepRows = (name: string, rows: typeof withIntents) =>
  rows.map((r) => [name, num(r.minConfidence), `${r.confusion.tp}/${r.confusion.tp + r.confusion.fn}`, ...row("", r.summary).slice(1, 4)]);
console.log(
  table(
    ["Gatilho", "Confiança mínima", "Risco que subiu", "Acerto", "Subiu", "Custo por 1.000"],
    [...sweepRows("Intenção + confiança", withIntents), ...sweepRows("Só confiança", confidenceOnly)],
  ),
);
console.log();
const high = stepZeroConfidence.filter((c) => c >= 0.95).length;
console.log(`Confiança do passo 0 (${label(CHEAP)}): mínima ${num(Math.min(...stepZeroConfidence))}, ${high} de ${stepZeroConfidence.length} ≥ 0,95.`);
