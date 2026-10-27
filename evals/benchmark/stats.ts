/**
 * Estatística pequena e sem dependências: média, percentis, intervalo de confiança
 * por bootstrap e sorteio de pesos. Tudo determinístico (semente fixa) para que
 * rodar o relatório duas vezes dê os mesmos números.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Percentil por interpolação linear (p entre 0 e 100). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/** Gerador pseudoaleatório com semente (mulberry32): mesmo resultado em toda execução. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Interval {
  mean: number;
  low: number;
  high: number;
}

/**
 * Intervalo de confiança de 95% da média por bootstrap percentil: reamostra os
 * valores com reposição muitas vezes e pega os percentis 2,5 e 97,5 das médias.
 * Com n pequeno o intervalo sai largo — e é isso que ele deve mostrar.
 */
export function bootstrapMean(values: number[], iterations = 2_000, seed = 42): Interval {
  if (values.length === 0) return { mean: NaN, low: NaN, high: NaN };
  const random = seededRandom(seed);
  const means: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) sum += values[Math.floor(random() * values.length)];
    means.push(sum / values.length);
  }
  return { mean: mean(values), low: percentile(means, 2.5), high: percentile(means, 97.5) };
}

/** Correlação de Spearman (postos, com empates pela média). */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return NaN;
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? NaN : num / Math.sqrt(da * db);
}

function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((x, y) => x.value - y.value);
  const result = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[order[k].index] = rank;
    i = j + 1;
  }
  return result;
}

/** Sorteia um vetor de pesos uniforme no simplex (Dirichlet(1, …, 1)). */
export function randomWeights(count: number, random: () => number): number[] {
  const draws = Array.from({ length: count }, () => -Math.log(1 - random()));
  const total = draws.reduce((sum, v) => sum + v, 0);
  return draws.map((v) => v / total);
}
