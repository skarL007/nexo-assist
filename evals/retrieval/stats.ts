/**
 * Estatística dos benchmarks (pura, testada em stats.test.ts).
 *
 * - Wilson: intervalo de 95% de uma proporção. Com 81 perguntas, "96%" quer dizer algo entre 90% e 99%.
 * - McNemar exato: compara duas versões nas MESMAS perguntas. Só as discordâncias contam
 *   (uma acertou e a outra errou); o p é o da binomial com p = 0,5, bicaudal.
 * - fingerprint: SHA-256 curto de um conjunto de perguntas, para congelá-lo (padrão ouro).
 */
import { createHash } from "node:crypto";

const Z95 = 1.959964;

export function wilson(successes: number, total: number, z = Z95): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 1 };
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function binomialTwoSided(k: number, n: number): number {
  // P(X <= min(k, n-k)) * 2, com X ~ Binomial(n, 0,5); limitado a 1.
  const smaller = Math.min(k, n - k);
  let tail = 0;
  let coefficient = 1;
  for (let i = 0; i <= smaller; i++) {
    if (i > 0) coefficient = (coefficient * (n - i + 1)) / i;
    tail += coefficient;
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

/** `a[i]` e `b[i]`: se cada versão acertou a pergunta i. */
export function mcnemar(a: boolean[], b: boolean[]): { aOnly: number; bOnly: number; p: number } {
  if (a.length !== b.length) throw new Error("McNemar exige as mesmas perguntas nas duas versões.");
  const aOnly = a.filter((right, i) => right && !b[i]).length;
  const bOnly = a.filter((right, i) => !right && b[i]).length;
  const discordant = aOnly + bOnly;
  return { aOnly, bOnly, p: discordant === 0 ? 1 : binomialTwoSided(aOnly, discordant) };
}

/** Chaves ordenadas: o mesmo conteúdo dá a mesma impressão, qualquer edição muda. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex").slice(0, 12);
}
