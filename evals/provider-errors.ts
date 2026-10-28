/**
 * O que é (e o que não é) "erro do provedor" nos runners de eval.
 *
 * Antes, o `catch` do cenário contava QUALQUER exceção como "erro do provedor", esperava e repetia.
 * Assim o limite de mensagens do próprio app (`DomainError("message_limit")`) apareceu no log como
 * 15 "erros do provedor", e um erro de banco ia pelo mesmo caminho. Aqui a regra é positiva: só
 * o que o modelo ou a rede devolvem é repetido; o resto para o runner com o motivo real.
 */
import { DomainError } from "@/domain/errors";
import { describeError } from "./describe-error";

/** Falha do modelo detectada pelo harness (ex.: turno sem uso do modelo). É repetida como erro do provedor. */
export class ProviderError extends Error {
  override name = "ProviderError";
}

/** Falha que não é do provedor (regra do app, banco, harness): o runner para e mostra o motivo. */
export class EvalHarnessError extends Error {
  override name = "EvalHarnessError";
}

export type EvalErrorKind = "provider" | "domain" | "database" | "unknown";

const MAX_DEPTH = 8;
/** Códigos de rede do Node/undici que indicam o provedor (ou o caminho até ele) fora do ar. */
const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "ECONNABORTED"]);
const PROVIDER_MESSAGE = /fetch failed|high demand|overloaded|rate.?limit|resource.?exhausted|service unavailable/i;
const DATABASE_NAMES = new Set(["LibsqlError", "DrizzleQueryError", "DrizzleError", "TransactionRollbackError"]);

type Node = Record<string, unknown>;

/** O erro e tudo que ele encadeia (`cause`; `lastError` do RetryError do AI SDK), sem laço. */
function chain(error: unknown): Node[] {
  const nodes: Node[] = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length && nodes.length < MAX_DEPTH) {
    const current = queue.shift();
    if (typeof current !== "object" || current === null || seen.has(current)) continue;
    seen.add(current);
    const node = current as Node;
    nodes.push(node);
    queue.push(node.cause, node.lastError);
  }
  return nodes;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

function isDomain(node: Node) {
  return node instanceof DomainError || node.name === "DomainError";
}

function isDatabase(node: Node) {
  return DATABASE_NAMES.has(text(node.name)) || text(node.code).startsWith("SQLITE_") || text(node.message).startsWith("Failed query:");
}

function isProvider(node: Node) {
  if (node instanceof ProviderError) return true;
  // Resposta HTTP do provedor: só os transitórios (408, 429, 5xx) valem nova tentativa; 400/401/403 são chave ou requisição.
  if (typeof node.statusCode === "number") return node.statusCode === 408 || node.statusCode === 429 || node.statusCode >= 500;
  if (node.name === "AI_APICallError" || node.name === "TimeoutError" || node.name === "AbortError") return true;
  if (node.isRetryable === true || node.category === "THIRD_PARTY") return true;
  const code = text(node.code);
  if (NETWORK_CODES.has(code) || code.startsWith("UND_ERR")) return true;
  return PROVIDER_MESSAGE.test(text(node.message));
}

/**
 * Classifica o erro olhando a cadeia inteira. Regra do app e banco vencem: um `DomainError`
 * embrulhado por outro erro continua sendo regra do app. O que não for reconhecido como do
 * provedor é "unknown" (para o runner), não "provider".
 */
export function classifyEvalError(error: unknown): EvalErrorKind {
  const nodes = chain(error);
  if (nodes.some(isDomain)) return "domain";
  if (nodes.some(isDatabase)) return "database";
  if (nodes.some(isProvider)) return "provider";
  return "unknown";
}

interface ReplyLike {
  role: string;
  trace?: { model?: string | null; usage?: { inputTokens?: number } | null } | null;
}

/**
 * O Mastra às vezes engole o 503 e o turno sai com a resposta reserva, sem uso do modelo (null ou zerado).
 * Contar isso como acerto deixaria o cenário "passar" sem o modelo ter respondido: vira erro do provedor.
 */
export function assertModelResponded(reply: ReplyLike | null | undefined): void {
  if (reply?.role === "agent" && reply.trace?.model && !reply.trace.usage?.inputTokens) {
    throw new ProviderError("turno sem resposta do modelo (provedor)");
  }
}

const KIND_LABEL: Record<Exclude<EvalErrorKind, "provider">, string> = {
  domain: "erro de regra do app",
  database: "erro de banco",
  unknown: "erro não reconhecido como do provedor",
};

export interface RetryOptions {
  /** Nome do cenário ou da conversa, para o motivo da parada. */
  label: string;
  attempts: number;
  /** Espera antes da próxima tentativa, em função do número da tentativa que falhou. */
  waitMs: (attempt: number) => number;
  log: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Roda `play` e repete só quando a falha é do provedor. Esgotadas as tentativas devolve
 * `value: null`. Qualquer outro erro lança `EvalHarnessError` na hora, com o motivo inteiro.
 */
export async function retryOnProviderError<T>(play: (attempt: number) => Promise<T>, options: RetryOptions): Promise<{ value: T | null; providerErrors: number }> {
  const sleep = options.sleep ?? defaultSleep;
  let providerErrors = 0;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return { value: await play(attempt), providerErrors };
    } catch (error) {
      const kind = classifyEvalError(error);
      if (kind !== "provider") {
        throw new EvalHarnessError(`${options.label}: ${KIND_LABEL[kind]} (não é falha do provedor, por isso não foi repetido): ${describeError(error)}`, { cause: error });
      }
      providerErrors++;
      options.log(`(erro do provedor na tentativa ${attempt}: ${describeError(error)})`);
      if (attempt < options.attempts) await sleep(options.waitMs(attempt));
    }
  }
  return { value: null, providerErrors };
}
