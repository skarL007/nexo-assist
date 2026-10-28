/** Ajudantes das rotas: erro HTTP, validação do corpo, proteção CSRF e resposta de erro padrão. */
import type { z } from "zod";
import { DomainError, type DomainErrorCode } from "@/domain/errors";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const STATUS_BY_DOMAIN_ERROR: Record<DomainErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403,
  invalid_transition: 409,
  reopen_window_expired: 409,
  draft_not_pending: 409,
  confirmation_required: 409,
  different_problem: 409,
  conflict: 409,
  message_limit: 429,
  daily_limit: 429,
  legacy_unavailable: 503,
  agent_unavailable: 503,
};

/** Só aceita JSON de verdade: um formulário de outro site não consegue montar este pedido. */
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const mime = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mime !== "application/json") {
    throw new HttpError(415, "Envie os dados em JSON.");
  }
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Dados inválidos.");
  return result.data;
}

/**
 * Proteção CSRF: um pedido que altera dados precisa vir do próprio site.
 * O navegador informa a origem em Sec-Fetch-Site (ou Origin). Sem nenhum
 * dos dois, não é um navegador — e então não carrega o cookie da vítima.
 */
export function isCrossSiteMutation(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true; // "null" ou lixo: não dá para provar que é o próprio site
  }
}

/**
 * Registra o erro sem dados pessoais. Erro do banco (DrizzleQueryError) traz na
 * mensagem a consulta com os parâmetros (texto do chat, e-mail); por isso, quando
 * há uma causa, vai só a causa (ex.: "SQLITE_BUSY: database is locked").
 * O corpo da requisição ao LLM também nunca é registrado.
 */
export function logError(error: unknown) {
  if (error instanceof Error) {
    const status = (error as { statusCode?: number }).statusCode;
    const detail = error.cause instanceof Error ? `causa: ${error.cause.message}` : error.message;
    console.error(`[${error.name}]${status ? ` ${status}` : ""} ${detail}`);
  } else {
    console.error("[erro desconhecido]", String(error));
  }
}

/** Converte qualquer erro numa resposta JSON. Erro inesperado não vaza detalhes. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof DomainError) {
    return Response.json({ error: error.message, code: error.code }, { status: STATUS_BY_DOMAIN_ERROR[error.code] });
  }
  logError(error);
  return Response.json({ error: "Algo deu errado do nosso lado. Tente de novo." }, { status: 500 });
}

/** Envolve um handler: bloqueia CSRF e transforma qualquer erro em errorResponse. */
export function handle<A extends [Request, ...unknown[]]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (isCrossSiteMutation(args[0])) throw new HttpError(403, "Pedido de outra origem bloqueado.");
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
