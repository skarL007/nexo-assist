/** Erro de regra de negócio, com um código estável e uma mensagem para o usuário. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type DomainErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_transition"
  | "reopen_window_expired"
  | "draft_not_pending"
  | "message_limit"
  | "daily_limit"
  | "legacy_unavailable";
