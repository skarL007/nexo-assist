/**
 * Gera o relatório a partir do cache: docs/benchmark/resultados.json (dados),
 * docs/benchmark/TABELAS.md (tabelas) e os gráficos SVG. Não chama API nenhuma.
 * A análise escrita fica em docs/benchmark/RELATORIO.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { scenarios } from "../scenarios";
import { ANCHORS as CALIBRATION_ANCHORS, calibrationPasses, type AnchorLevel } from "./calibration";
import { compositeChart, paretoChart } from "./charts";
import { ANCHORS, BUSINESS, CANDIDATES, JUDGES, WEIGHT_PROFILES, WEIGHTS } from "./config";
import type { GateResult } from "./gate";
import { CRITERIA } from "./geval";
import { loadConversations } from "./job";
import { judgmentSchema, PATHS, readJson, readJsonl } from "./records";
import { judgeAgreement, paretoFrontier, projectMonthlyCost, summarizeCandidate, weightSensitivity, type CandidateSummary } from "./scoring";
import { mean } from "./stats";

const OUT_DIR = "docs/benchmark";

const num = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
const pct = (value: number) => (Number.isFinite(value) ? `${num(value * 100, 0)}%` : "—");
const money = (value: number, digits = 4) => (Number.isFinite(value) ? `US$ ${num(value, digits)}` : "—");
const seconds = (ms: number) => (Number.isFinite(ms) ? `${num(ms / 1000, 1)} s` : "—");
const statusNote = (s: CandidateSummary) =>
  s.disqualifiedReason ? `desqualificado — ${s.disqualifiedReason}` : s.status === "avaliado" ? "sem notas dos juízes" : s.status;
const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

export function buildReport() {
  const judgments = readJsonl(PATHS.judgments, judgmentSchema);
  const gates = readJson<Record<string, GateResult>>(PATHS.gate, {});
  const calibration = readJson<Record<string, Record<AnchorLevel, Record<string, number>>>>(PATHS.calibration, {});
  const runs = readJson<Array<Record<string, unknown>>>(PATHS.runs, []);

  const summaries = CANDIDATES.map((candidate) =>
    summarizeCandidate(
      candidate,
      loadConversations(candidate.key),
      judgments.filter((j) => j.candidate === candidate.key),
      gates[candidate.key],
      WEIGHTS,
    ),
  );
  const evaluated = summaries.filter((s): s is CandidateSummary & { scores: NonNullable<CandidateSummary["scores"]> } => s.scores !== null);
  const ranked = [...evaluated].sort((a, b) => b.scores.composite - a.scores.composite);
  const frontier = paretoFrontier(evaluated.map((s) => ({ key: s.key, cost: s.cost.perAtendimentoUsd, quality: s.quality.overall.mean })));
  const sensitivity = weightSensitivity(evaluated.map((s) => ({ key: s.key, scores: s.scores })), WEIGHT_PROFILES);
  const agreement = JUDGES.length >= 2 ? judgeAgreement(judgments, JUDGES[0].key, JUDGES[1].key) : null;
  const labelOf = (key: string) => summaries.find((s) => s.key === key)?.label ?? key;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    `${OUT_DIR}/resultados.json`,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        premissas: { weights: WEIGHTS, anchors: ANCHORS, business: BUSINESS, judges: JUDGES.map((j) => ({ key: j.key, model: j.model, method: j.method, samples: j.samples })) },
        ranking: ranked.map((s) => s.key),
        paretoFrontier: frontier,
        sensitivity,
        judgeAgreement: agreement,
        calibration,
        gates,
        runs,
        candidates: summaries.map((s) => ({ ...s, projection: Number.isFinite(s.cost.perAtendimentoUsd) ? projectMonthlyCost(s.cost.perAtendimentoUsd) : [] })),
      },
      null,
      2,
    )}\n`,
  );

  if (evaluated.length) writeFileSync(
    `${OUT_DIR}/pareto.svg`,
    paretoChart(evaluated.map((s) => ({ label: s.label, costUsd: s.cost.perAtendimentoUsd, quality: s.quality.overall.mean, onFrontier: frontier.includes(s.key) }))),
  );
  writeFileSync(
    `${OUT_DIR}/composto.svg`,
    compositeChart([
      ...ranked.map((s) => ({
        label: s.label,
        parts: {
          effectiveness: WEIGHTS.effectiveness * s.scores.effectiveness,
          quality: WEIGHTS.quality * s.scores.quality,
          latency: WEIGHTS.latency * s.scores.latency,
          cost: WEIGHTS.cost * s.scores.cost,
        },
      })),
      ...summaries.filter((s) => !s.scores).map((s) => ({ label: s.label, parts: null, note: statusNote(s) })),
    ]),
  );

  const md: string[] = [
    "# Benchmark de modelos — tabelas (gerado)",
    "",
    `> Gerado por \`npm run benchmark -- --report\` em ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC a partir de \`evals/benchmark/results/\`. Não edite à mão: a análise está em [RELATORIO.md](RELATORIO.md).`,
    "",
    `## Ranking — score composto (pesos ${Object.values(WEIGHTS).map((w) => w * 100).join("/")})`,
    "",
    table(
      ["#", "Modelo", "Composto", "Efetividade", "Qualidade (1–5) [IC 95%]", "Latência p50", "Custo/atendimento", "Pareto"],
      ranked.map((s, i) => [
        String(i + 1),
        `**${s.label}**`,
        num(s.scores.composite, 3),
        pct(s.passRate.mean),
        `${num(s.quality.overall.mean)} [${num(s.quality.overall.low)}–${num(s.quality.overall.high)}]`,
        seconds(s.latency.p50),
        money(s.cost.perAtendimentoUsd),
        frontier.includes(s.key) ? "✓" : "",
      ]),
    ),
    "",
    ...summaries.filter((s) => !s.scores).map((s) => `- **${s.label}**: ${statusNote(s)}`),
    "",
    "![Score composto por dimensão](composto.svg)",
    "",
    "## Qualidade × custo (fronteira de Pareto)",
    "",
    "![Qualidade × custo por atendimento](pareto.svg)",
    "",
    `Na fronteira: ${frontier.map(labelOf).join(", ") || "—"}.`,
    "",
    "## Efetividade — checagens determinísticas (as mesmas do `npm run eval`)",
    "",
    table(
      ["Modelo", "Cenários ok [IC 95%]", "Conversas", "1º passo = recordUnderstanding", "Tool pedida e não executada", "Turnos com erro", "Retentativas por 429"],
      summaries.map((s) => [
        s.label,
        s.conversations ? `${pct(s.passRate.mean)} [${pct(s.passRate.low)}–${pct(s.passRate.high)}]` : "—",
        String(s.conversations),
        s.turns ? pct(s.forcedToolCompliance) : "—",
        s.turns ? pct(s.toolCallErrorRate) : "—",
        s.turns ? pct(s.turnErrorRate) : "—",
        String(s.rateLimitRetries),
      ]),
    ),
    "",
    "Aprovações por cenário (aprovadas / repetições):",
    "",
    table(
      ["Cenário", ...summaries.filter((s) => s.conversations).map((s) => s.label)],
      scenarios.map((scenario) => [
        scenario.name,
        ...summaries.filter((s) => s.conversations).map((s) => {
          const entry = s.scenarioPasses[scenario.name];
          return entry ? `${entry.passed}/${entry.total}` : "—";
        }),
      ]),
    ),
    "",
    "## Qualidade — G-Eval, média do painel de juízes (1–5)",
    "",
    table(
      ["Modelo", ...CRITERIA.map((c) => c.name), "Geral", ...JUDGES.map((j) => `só ${j.label}`)],
      evaluated.map((s) => [
        s.label,
        ...CRITERIA.map((c) => num(s.quality.byCriterion[c.id])),
        `**${num(s.quality.overall.mean)}**`,
        ...JUDGES.map((j) => num(s.quality.byJudge[j.key] ?? NaN)),
      ]),
    ),
    "",
    "## Latência e uso de tokens (por turno)",
    "",
    table(
      ["Modelo", "p50", "p95", "1ª palavra (p50)", "Chamadas ao modelo", "Tokens de entrada", "Tokens de saída", "Tokens de raciocínio"],
      summaries.filter((s) => s.turns).map((s) => [
        s.label,
        seconds(s.latency.p50),
        seconds(s.latency.p95),
        seconds(s.latency.ttftP50),
        num(s.usage.callsPerTurn, 1),
        num(s.usage.inputTokensPerTurn, 0),
        num(s.usage.outputTokensPerTurn, 0),
        num(s.usage.reasoningTokensPerTurn, 0),
      ]),
    ),
    "",
    "## Custo real (OpenRouter `usage.cost`) e projeção mensal",
    "",
    `Premissas: ${BUSINESS.turnsPerAtendimento} turnos por atendimento; ${num(BUSINESS.atendimentosPerEmployeeMonth, 1)} atendimento por funcionário por mês (cenário alto: ${num(BUSINESS.atendimentosPerEmployeeMonthHigh, 1)}).`,
    "",
    table(
      ["Modelo", "Gasto no benchmark", "Por turno", "Por atendimento", "Por 1.000 atendimentos", ...BUSINESS.employeeCounts.map((n) => `${n.toLocaleString("pt-BR")} func./mês`)],
      summaries.filter((s) => s.turns).map((s) => [
        s.label,
        money(s.cost.totalUsd, 3),
        money(s.cost.perTurnUsd),
        money(s.cost.perAtendimentoUsd),
        money(s.cost.per1000AtendimentosUsd, 2),
        ...projectMonthlyCost(s.cost.perAtendimentoUsd).map((row) => `${money(row.costPerMonthUsd, 2)} (alto ${money(row.costPerMonthHighUsd, 2)})`),
      ]),
    ),
    "",
    `Referência humana: ${money(BUSINESS.humanCostPerTicketUsd, 2)} por chamado no nível 1 (MetricNet/HDI) → ${projectMonthlyCost(0)
      .map((row) => `${row.employees.toLocaleString("pt-BR")} func.: ${money(row.humanEquivalentUsd, 0)}/mês`)
      .join(" · ")}.`,
    "",
    "## Sensibilidade aos pesos",
    "",
    table(
      ["Perfil", "Pesos (efet./qual./lat./custo)", "1º", "2º", "3º"],
      Object.entries(sensitivity.profiles).map(([name, ranking]) => [
        name,
        Object.values(WEIGHT_PROFILES[name]).map((w) => Math.round(w * 100)).join("/"),
        ...[0, 1, 2].map((i) => (ranking[i] ? labelOf(ranking[i]) : "—")),
      ]),
    ),
    "",
    "Com 10 mil vetores de pesos sorteados ao acaso (Dirichlet uniforme), quem fica em 1º:",
    "",
    table(
      ["Modelo", "Vezes em 1º"],
      Object.entries(sensitivity.winShare)
        .sort((a, b) => b[1] - a[1])
        .map(([key, share]) => [labelOf(key), pct(share)]),
    ),
    "",
    "## Juízes",
    "",
    "Calibração com três conversas de qualidade conhecida (média dos critérios):",
    "",
    table(
      ["Juiz", "Método", ...Object.keys(CALIBRATION_ANCHORS), "Ordem certa?"],
      JUDGES.filter((j) => calibration[j.key]).map((j) => {
        const means = Object.fromEntries(
          (Object.keys(CALIBRATION_ANCHORS) as AnchorLevel[]).map((level) => [level, mean(Object.values(calibration[j.key][level]))]),
        ) as Record<AnchorLevel, number>;
        return [
          j.label,
          j.method === "logprobs" ? "logprobs (média ponderada)" : `amostragem (n=${j.samples})`,
          ...(Object.keys(CALIBRATION_ANCHORS) as AnchorLevel[]).map((l) => num(means[l])),
          calibrationPasses(means) ? "✓" : "✗",
        ];
      }),
    ),
    "",
    agreement
      ? `Concordância entre ${JUDGES[0].label} e ${JUDGES[1].label} nas ${agreement.n} conversas: Spearman ${num(agreement.spearman)}, diferença média absoluta ${num(agreement.meanAbsDiff)} ponto (médias ${num(agreement.meanA)} e ${num(agreement.meanB)}).`
      : "",
    "",
    "## Pré-voo — tool_choice forçado",
    "",
    table(
      ["Configuração", "Esforço de raciocínio", "Passou?", "Provedor", "Detalhe"],
      CANDIDATES.map((c) => {
        const gate = gates[c.key];
        return [c.label, c.effort, gate ? (gate.passed ? "✓" : "✗") : "—", gate?.provider ?? "—", gate?.error ?? (gate ? `chamou ${gate.toolCalled}` : "não testado")];
      }),
    ),
    "",
    "## Provedores que atenderam (chamadas)",
    "",
    table(
      ["Modelo", "Provedores"],
      summaries.filter((s) => s.turns).map((s) => [
        s.label,
        Object.entries(s.providers)
          .sort((a, b) => b[1] - a[1])
          .map(([p, n]) => `${p} (${n})`)
          .join(", "),
      ]),
    ),
    "",
    "## Gasto por execução (medido pela chave do OpenRouter)",
    "",
    table(
      ["Início", "Gasto pela chave", "Somado por chamada", "Crédito restante"],
      runs.map((r) => [
        String(r.startedAt).slice(0, 16).replace("T", " "),
        money(Number(r.spentByKeyUsd)),
        money(Number(r.trackedUsd)),
        r.keyLimitRemainingUsd === null ? "—" : money(Number(r.keyLimitRemainingUsd)),
      ]),
    ),
    "",
  ];
  writeFileSync(`${OUT_DIR}/TABELAS.md`, md.join("\n"));

  console.log("\nRanking:");
  ranked.forEach((s, i) =>
    console.log(
      `  ${i + 1}. ${s.label.padEnd(32)} composto ${num(s.scores.composite, 3)} · efetividade ${pct(s.passRate.mean)} · qualidade ${num(s.quality.overall.mean)} · p50 ${seconds(s.latency.p50)} · ${money(s.cost.perAtendimentoUsd)}/atendimento`,
    ),
  );
  console.log(`\nRelatório: ${OUT_DIR}/TABELAS.md · ${OUT_DIR}/resultados.json`);
}
