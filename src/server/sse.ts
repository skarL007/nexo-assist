import type { WatchEvent } from "@/application/change-watcher";

/** Reconexão rápida: cada stream dura menos que o limite da função e o navegador volta em 1 s. */
const RETRY_MS = 1000;

/** Transforma os eventos do vigia em uma resposta text/event-stream (EventSource no navegador). */
export function sseResponse(events: AsyncIterable<WatchEvent>): Response {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  let started = false;

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        controller.enqueue(encoder.encode(`retry: ${RETRY_MS}\n\n`));
        return;
      }
      const { value, done } = await iterator.next();
      if (done) return controller.close();
      controller.enqueue(encoder.encode(value.type === "change" ? "event: change\ndata: {}\n\n" : ": ping\n\n"));
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
