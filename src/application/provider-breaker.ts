/**
 * Disjuntor dos provedores da busca (embeddings e avaliador de relevância): depois de uma falha, o
 * provedor fica de fora por um tempo e a busca segue sem ele, em vez de cada mensagem esperar uma
 * chamada que vai falhar de novo. Fica na memória da instância (na Vercel, enquanto a função estiver quente).
 */

/** Erro HTTP de um provedor, com o status para o disjuntor decidir quanto esperar. */
export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    label = "Provedor",
  ) {
    super(`${label} ${status}`);
    this.name = "ProviderHttpError";
  }
}

export class EmbeddingHttpError extends ProviderHttpError {
  constructor(status: number) {
    super(status, "Embeddings");
    this.name = "EmbeddingHttpError";
  }
}

const NO_CREDIT_OR_ACCESS = [401, 402, 403];

/** Sem crédito ou sem permissão não se resolve em segundos: 15 min. O resto (timeout, 429, 5xx, rede): 1 min. */
export function cooldownMs(error: unknown): number {
  return error instanceof ProviderHttpError && NO_CREDIT_OR_ACCESS.includes(error.status) ? 15 * 60_000 : 60_000;
}

export class ProviderBreaker {
  private readonly openUntil = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  isOpen(provider: string): boolean {
    return (this.openUntil.get(provider) ?? 0) > this.now();
  }

  trip(provider: string, error: unknown): void {
    this.openUntil.set(provider, this.now() + cooldownMs(error));
  }
}
