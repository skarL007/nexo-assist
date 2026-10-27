/** Ajudantes das rotas: erro HTTP, validação do corpo e resposta de erro padrão. */
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
  not_found: 404,
  forbidden: 403,
  invalid_transition: 409,
  reopen_window_expired: 409,
  draft_not_pending: 409,
  message_limit: 429,
  daily_limit: 429,
  legacy_unavailable: 503,
};

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Dados inválidos.");
  return result.data;
}

/** Converte qualquer erro numa resposta JSON. Erro inesperado não vaza detalhes. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof DomainError) {
    return Response.json({ error: error.message, code: error.code }, { status: STATUS_BY_DOMAIN_ERROR[error.code] });
  }
  console.error(error);
  return Response.json({ error: "Algo deu errado do nosso lado. Tente de novo." }, { status: 500 });
}

/** Envolve um handler: qualquer erro vira errorResponse. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
