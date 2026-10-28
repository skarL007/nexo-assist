/**
 * Vigia de mudanças para o tempo real (SSE). Não há fila de eventos entre as
 * funções da Vercel, então o servidor confere uma assinatura barata do banco a
 * cada `intervalMs` e só avisa "mudou": a tela busca os dados de novo.
 * Termina em `maxMs` (limite da função), quando o banco falha ou o cliente sai;
 * o navegador reconecta sozinho e, se não conseguir, a tela volta ao polling.
 */
export type WatchEvent = { type: "change" } | { type: "ping" };

export interface WatchOptions {
  intervalMs: number;
  /** Comentário periódico para proxies não derrubarem a conexão parada. */
  heartbeatMs: number;
  maxMs: number;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function* watchChanges(version: () => Promise<string>, options: WatchOptions): AsyncGenerator<WatchEvent> {
  const { intervalMs, heartbeatMs, maxMs, signal, now = Date.now, sleep = realSleep } = options;
  if (signal?.aborted) return;

  let last = await version().catch(() => null);
  if (last === null) return;
  const start = now();
  let lastSent = start;

  while (now() - start < maxMs) {
    await sleep(intervalMs);
    if (signal?.aborted) return;
    const current = await version().catch(() => null);
    if (current === null) return;
    if (current !== last) {
      last = current;
      lastSent = now();
      yield { type: "change" };
    } else if (now() - lastSent >= heartbeatMs) {
      lastSent = now();
      yield { type: "ping" };
    }
  }
}
