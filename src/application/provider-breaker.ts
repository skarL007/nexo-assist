/**
 * Disjuntor dos provedores de embeddings: depois de uma falha, o provedor fica de fora por um tempo
 * e a busca vai direto ao próximo, em vez de cada mensagem esperar uma chamada que vai falhar de novo.
 * Fica na memória da instância (na Vercel, enquanto a função estiver quente).
 */

/** Erro HTTP de um provedor de embeddings, com o status para o disjuntor decidir quanto esperar. */
export class EmbeddingHttpError extends Error {
  constructor(readonly status: number) {
    super(`Embeddings ${status}`);
    this.name = "EmbeddingHttpError";
  }
}

const NO_CREDIT_OR_ACCESS = [401, 402, 403];

/** Sem crédito ou sem permissão não se resolve em segundos: 15 min. O resto (timeout, 429, 5xx, rede): 1 min. */
export function cooldownMs(error: unknown): number {
  return error instanceof EmbeddingHttpError && NO_CREDIT_OR_ACCESS.includes(error.status) ? 15 * 60_000 : 60_000;
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
