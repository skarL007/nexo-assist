/**
 * Chamadas aos juízes: gerar os passos do G-Eval (uma vez) e avaliar conversas.
 * Tudo passa pelo cache local de respostas (pedido idêntico não é pago de novo).
 * Erros temporários do provedor (429/5xx) são tentados de novo com espera.
 */
import { STEPS_AUTHOR, type Judge } from "./config";
import { CRITERIA, judgePrompt, scoresFromLogprobs, scoresFromText, stepsPrompt, type Steps } from "./geval";
import { cachedChat, type Completion } from "./openrouter";
import { mean } from "./stats";

async function chatWithRetry(body: Record<string, unknown>, salt = "", attempts = 3): Promise<Completion> {
  let last: Completion | null = null;
  for (let i = 1; i <= attempts; i++) {
    last = await cachedChat(body, salt).catch((error: unknown) => ({ ...emptyCompletion, error: String(error) }));
    const transient = last.status === 429 || last.status >= 500 || last.status === 0;
    if (last.ok || !transient) return last;
    await new Promise((resolve) => setTimeout(resolve, 5_000 * i));
  }
  return last!;
}

const emptyCompletion: Completion = {
  ok: false,
  status: 0,
  provider: null,
  text: "",
  toolCalls: [],
  logprobs: [],
  costUsd: 0,
  inputTokens: 0,
  cachedTokens: 0,
  outputTokens: 0,
  error: null,
  fromCache: false,
};

/** O que uma ou mais chamadas custaram agora, e o que o cache local evitou pagar. */
export interface CallCosts {
  /** Cobrado nesta execução. */
  costUsd: number;
  /** Economizado por respostas que vieram do cache local. */
  savedUsd: number;
  inputTokens: number;
  /** Tokens lidos do cache do provedor. */
  cachedTokens: number;
}

function costsOf(results: Completion[]): CallCosts {
  return {
    costUsd: results.filter((r) => !r.fromCache).reduce((sum, r) => sum + r.costUsd, 0),
    savedUsd: results.filter((r) => r.fromCache).reduce((sum, r) => sum + r.costUsd, 0),
    inputTokens: results.reduce((sum, r) => sum + r.inputTokens, 0),
    cachedTokens: results.reduce((sum, r) => sum + r.cachedTokens, 0),
  };
}

export async function generateSteps(): Promise<{ steps: Steps } & CallCosts> {
  const results = await Promise.all(
    CRITERIA.map((criterion) =>
      chatWithRetry({ model: STEPS_AUTHOR.model, messages: stepsPrompt(criterion), temperature: 0, max_tokens: 500, reasoning: { effort: STEPS_AUTHOR.effort } }),
    ),
  );
  const failed = results.find((r) => !r.ok || !r.text.trim());
  if (failed) throw new Error(`Falha ao gerar passos do G-Eval: ${failed.error}`);
  return { steps: Object.fromEntries(CRITERIA.map((c, i) => [c.id, results[i].text.trim()])), ...costsOf(results) };
}

export interface JudgeResult extends CallCosts {
  scores: Record<string, number>;
  methods: Record<string, string>;
  error: string | null;
}

export async function judgeTranscript(judge: Judge, transcript: string, steps: Steps): Promise<JudgeResult> {
  const messages = judgePrompt(transcript, steps);
  return judge.method === "logprobs" ? judgeWithLogprobs(judge, messages) : judgeBySampling(judge, messages);
}

/** Uma chamada; nota = média ponderada pelas probabilidades dos dígitos. */
async function judgeWithLogprobs(judge: Judge, messages: unknown[]): Promise<JudgeResult> {
  const result = await chatWithRetry({
    model: judge.model,
    messages,
    temperature: 1,
    max_tokens: 80,
    logprobs: true,
    top_logprobs: 5,
    reasoning: { effort: judge.effort },
    // Só provedores que devolvem logprobs.
    provider: { require_parameters: true },
  });
  const parsed = scoresFromLogprobs(result.logprobs);
  // Critério sem logprobs utilizável cai para a nota escrita.
  for (const [id, score] of Object.entries(scoresFromText(result.text))) {
    if (!(id in parsed.scores)) {
      parsed.scores[id] = score;
      parsed.methods[id] = "texto";
    }
  }
  return { ...parsed, ...costsOf([result]), error: missing(parsed.scores) ?? result.error };
}

/** n chamadas a temperatura 1; nota = média das notas escritas (como no artigo, com GPT-4). */
async function judgeBySampling(judge: Judge, messages: unknown[]): Promise<JudgeResult> {
  const samples = await Promise.all(
    // O salt separa as amostras no cache local: são pedidos iguais feitos de propósito.
    Array.from({ length: judge.samples }, (_, i) =>
      chatWithRetry({ model: judge.model, messages, temperature: 1, max_tokens: 400, reasoning: { effort: judge.effort } }, `amostra-${i}`),
    ),
  );
  const parsed = samples.map((s) => scoresFromText(s.text));
  const scores: Record<string, number> = {};
  const methods: Record<string, string> = {};
  for (const c of CRITERIA) {
    const values = parsed.map((p) => p[c.id]).filter((v): v is number => v !== undefined);
    if (values.length === 0) continue;
    scores[c.id] = mean(values);
    methods[c.id] = `amostragem n=${values.length}`;
  }
  return { scores, methods, ...costsOf(samples), error: missing(scores) ?? samples.find((s) => s.error)?.error ?? null };
}

function missing(scores: Record<string, number>): string | null {
  const absent = CRITERIA.filter((c) => !(c.id in scores)).map((c) => c.id);
  return absent.length ? `sem nota para: ${absent.join(", ")}` : null;
}
