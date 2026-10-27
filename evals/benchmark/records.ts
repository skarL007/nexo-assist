/**
 * Formato dos resultados salvos em disco (JSONL: um registro por linha).
 * O cache é o que permite rodar de novo sem gastar de novo: o que já está
 * no arquivo não é executado outra vez. Ao ler, o Zod valida cada linha.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const RESULTS_DIR = "evals/benchmark/results";
export const PATHS = {
  conversationsDir: `${RESULTS_DIR}/conversas`,
  judgments: `${RESULTS_DIR}/julgamentos.jsonl`,
  gate: `${RESULTS_DIR}/pre-voo.json`,
  steps: `${RESULTS_DIR}/passos-geval.json`,
  calibration: `${RESULTS_DIR}/calibracao.json`,
  runs: `${RESULTS_DIR}/execucoes.json`,
  prices: `${RESULTS_DIR}/precos.json`,
};

const llmCallSchema = z.object({
  status: z.number(),
  provider: z.string().nullable(),
  costUsd: z.number(),
  inputTokens: z.number(),
  cachedTokens: z.number(),
  cacheWriteTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  toolCalls: z.array(z.string()),
  finishReason: z.string().nullable(),
  error: z.string().nullable(),
  latencyMs: z.number(),
});

export const turnRecordSchema = z.object({
  text: z.string(),
  reply: z.string(),
  /** Cards da resposta já descritos em texto (o juiz precisa vê-los). */
  cards: z.array(z.string()),
  /** O que o modelo registrou em recordUnderstanding (é o "por quê?" que o funcionário vê). */
  decision: z.object({ intent: z.string(), understanding: z.string(), confidence: z.number(), reasoning: z.string() }).nullable(),
  /** Primeira tool executada: tem que ser recordUnderstanding (passo 0 forçado). */
  firstTool: z.string().nullable(),
  toolCalls: z.array(z.object({ tool: z.string(), input: z.string(), output: z.string() })),
  guardrails: z.array(z.string()),
  latencyMs: z.number(),
  /** Tempo até a primeira palavra da resposta aparecer para o funcionário. */
  ttftMs: z.number().nullable(),
  llmCalls: z.array(llmCallSchema),
  error: z.string().nullable(),
});
export type TurnRecord = z.infer<typeof turnRecordSchema>;

export const conversationRecordSchema = z.object({
  candidate: z.string(),
  model: z.string(),
  effort: z.string(),
  scenario: z.string(),
  rep: z.number(),
  employeeName: z.string(),
  startedAt: z.string(),
  turns: z.array(turnRecordSchema),
  finalStatus: z.string(),
  /** Tentativas até passar de um limite de taxa (429) do provedor. */
  attempts: z.number(),
  /** Custo das tentativas descartadas (dinheiro gasto mesmo assim). */
  discardedCostUsd: z.number(),
  failures: z.array(z.string()),
});
export type ConversationRecord = z.infer<typeof conversationRecordSchema>;

export const judgmentSchema = z.object({
  judge: z.string(),
  candidate: z.string(),
  scenario: z.string(),
  rep: z.number(),
  /** Nota esperada (1–5) por critério. */
  scores: z.record(z.string(), z.number()),
  /** Como a nota foi obtida em cada critério: logprobs, amostragem ou texto (sem logprobs). */
  methods: z.record(z.string(), z.string()),
  costUsd: z.number(),
  savedUsd: z.number(),
  inputTokens: z.number(),
  cachedTokens: z.number(),
  error: z.string().nullable(),
});
export type Judgment = z.infer<typeof judgmentSchema>;

export const conversationKey = (r: { candidate: string; scenario: string; rep: number }) => `${r.candidate}|${r.scenario}|${r.rep}`;
export const judgmentKey = (r: { judge: string; candidate: string; scenario: string; rep: number }) =>
  `${r.judge}|${conversationKey(r)}`;

export function readJsonl<T>(path: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .flatMap((line) => {
      const parsed = schema.safeParse(JSON.parse(line));
      return parsed.success ? [parsed.data] : [];
    });
}

export const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback);

export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function appendJsonl(path: string, item: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(item)}\n`);
}

/** Corta textos longos (saída de tool) para o registro e para o juiz. */
export function clip(value: unknown, max = 400): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
