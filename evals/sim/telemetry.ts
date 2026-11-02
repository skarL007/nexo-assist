/**
 * Benchmark de personas: a telemetria de cada conversa simulada (a mesma que o analista vê no
 * console e o Prometheus soma) e os portões de 95% (puro, testado em telemetry.test.ts).
 */
import type { TurnTrace } from "@/domain/message";
import { wilson } from "../retrieval/stats";

export interface TelemetrySummary {
  turns: number;
  tokens: { input: number; output: number };
  retrievals: number;
  /** Buscas por veredito do avaliador; "sem_avaliador" quando ele não entrou. */
  verdicts: Record<string, number>;
  degradedRetrievals: number;
  guardrails: number;
  fallbackTurns: number;
  failedSteps: number;
  meanConfidence: number | null;
  turnLatency: { p50: number; p95: number };
  retrievalLatency: { p50: number; p95: number };
  /** p95 da duração por ferramenta, em ms. */
  toolP95: Record<string, number>;
}

const quantile = (values: number[], q: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
};

export function summarizeTelemetry(traces: TurnTrace[]): TelemetrySummary {
  const retrievals = traces.flatMap((t) => t.retrievals ?? []);
  const confidences = traces.flatMap((t) => (t.decision ? [t.decision.confidence] : []));
  const byTool = new Map<string, number[]>();
  for (const call of traces.flatMap((t) => t.toolCalls)) byTool.set(call.tool, [...(byTool.get(call.tool) ?? []), call.durationMs]);
  const verdicts: Record<string, number> = {};
  for (const r of retrievals) verdicts[r.verdict ?? "sem_avaliador"] = (verdicts[r.verdict ?? "sem_avaliador"] ?? 0) + 1;

  return {
    turns: traces.length,
    tokens: {
      input: traces.reduce((s, t) => s + (t.usage?.inputTokens ?? 0), 0),
      output: traces.reduce((s, t) => s + (t.usage?.outputTokens ?? 0), 0),
    },
    retrievals: retrievals.length,
    verdicts,
    degradedRetrievals: retrievals.filter((r) => r.degraded.length > 0).length,
    guardrails: traces.reduce((s, t) => s + t.guardrails.length, 0),
    fallbackTurns: traces.filter((t) => t.fallbackFrom).length,
    failedSteps: traces.reduce((s, t) => s + t.steps.filter((step) => !step.ok).length, 0),
    meanConfidence: confidences.length ? confidences.reduce((s, c) => s + c, 0) / confidences.length : null,
    turnLatency: { p50: quantile(traces.map((t) => t.latencyMs), 0.5), p95: quantile(traces.map((t) => t.latencyMs), 0.95) },
    retrievalLatency: { p50: quantile(retrievals.map((r) => r.latencyMs), 0.5), p95: quantile(retrievals.map((r) => r.latencyMs), 0.95) },
    toolP95: Object.fromEntries([...byTool].map(([tool, durations]) => [tool, quantile(durations, 0.95)])),
  };
}

/** Uma execução de uma persona: passou no estado do banco? E as notas da G-Eval (1–5), se medidas. */
export interface PersonaRun {
  persona: string;
  style: string;
  pass: boolean;
  geval: Record<string, number> | null;
}

export const GATES = { passRate: 0.95, geval: 4.5 };

interface RateGate {
  k: number;
  n: number;
  rate: number;
  low: number;
  high: number;
  ok: boolean;
}

const rateGate = (k: number, n: number): RateGate => ({ k, n, rate: n ? k / n : 0, ...wilson(k, n), ok: n > 0 && k / n >= GATES.passRate });

/**
 * Aprovado = taxa de sucesso ≥ 95% no total E em cada estilo de persona, E a média da G-Eval ≥ 4,5
 * em cada critério. O IC de Wilson vai junto: com poucas execuções, 95% medido não prova 95% real.
 */
export function evaluateGates(runs: PersonaRun[]) {
  const passRate = rateGate(runs.filter((r) => r.pass).length, runs.length);
  const styles = [...new Set(runs.map((r) => r.style))];
  const byStyle = styles.map((style) => {
    const mine = runs.filter((r) => r.style === style);
    return { style, ...rateGate(mine.filter((r) => r.pass).length, mine.length) };
  });
  const scored = runs.flatMap((r) => (r.geval ? [r.geval] : []));
  const criteria = [...new Set(scored.flatMap((g) => Object.keys(g)))];
  const geval = criteria.map((criterion) => {
    const values = scored.flatMap((g) => (criterion in g ? [g[criterion]] : []));
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return { criterion, mean, n: values.length, ok: mean >= GATES.geval };
  });
  const approved = passRate.ok && byStyle.every((s) => s.ok) && geval.length > 0 && geval.every((g) => g.ok);
  return { passRate, byStyle, geval, approved };
}
