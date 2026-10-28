/**
 * pass^k do τ-bench: chance de o agent acertar em TODAS as k tentativas de uma tarefa,
 * estimada sem viés a partir de n execuções com c acertos: C(c, k) / C(n, k).
 * pass^1 é a taxa simples; pass^k cai rápido quando o agent é instável.
 */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

export function passHatK(n: number, c: number, k: number): number {
  if (k > n) throw new Error(`k (${k}) maior que o número de execuções (${n})`);
  return binomial(c, k) / binomial(n, k);
}
