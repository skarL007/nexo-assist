import { watchChanges } from "@/application/change-watcher";
import { sseResponse } from "./sse";

/**
 * Parâmetros do tempo real. Cada stream dura menos que o limite da função (60 s)
 * e o navegador reconecta; a conferência no banco é uma consulta de agregados.
 */
export const LIVE = { intervalMs: 1000, heartbeatMs: 15_000, maxMs: 50_000 } as const;

/** Stream SSE que avisa "change" quando a assinatura muda. */
export function liveStream(request: Request, version: () => Promise<string>): Response {
  return sseResponse(watchChanges(version, { ...LIVE, signal: request.signal }));
}
