/**
 * Controle de gasto: estimativa antes de rodar (pré-voo) e contagem ao vivo.
 * Preços do catálogo do OpenRouter vêm em US$ por token.
 */

export interface Price {
  input: number;
  output: number;
}

export interface Tokens {
  input: number;
  output: number;
}

/** Custo estimado de N chamadas com o volume de tokens informado. */
export function estimateCost(price: Price, calls: number, tokens: Tokens): number {
  return calls * (tokens.input * price.input + tokens.output * price.output);
}

/** Soma o que já foi gasto e diz se ainda cabe mais um gasto no teto. */
export class SpendTracker {
  private total = 0;

  constructor(readonly capUsd: number) {}

  get spentUsd(): number {
    return this.total;
  }

  get remainingUsd(): number {
    return Math.max(0, this.capUsd - this.total);
  }

  add(usd: number) {
    this.total += usd;
  }

  /** true se gastar `usd` agora ainda deixa `reserveUsd` livre no teto. */
  fits(usd: number, reserveUsd = 0): boolean {
    return this.total + usd + reserveUsd <= this.capUsd;
  }
}

export const usd = (value: number, digits = 4) => `US$ ${value.toFixed(digits)}`;
