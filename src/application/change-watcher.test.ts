import { describe, expect, it } from "vitest";
import { watchChanges, type WatchEvent } from "./change-watcher";

/** Relógio falso: sleep só avança o tempo, sem esperar de verdade. */
function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

async function collect(versions: (string | Error)[], options: { maxMs: number; heartbeatMs?: number; signal?: AbortSignal }) {
  const clock = fakeClock();
  let call = 0;
  const version = async () => {
    const value = versions[Math.min(call++, versions.length - 1)];
    if (value instanceof Error) throw value;
    return value;
  };
  const events: WatchEvent[] = [];
  for await (const event of watchChanges(version, { intervalMs: 1000, heartbeatMs: 15_000, ...options, ...clock })) events.push(event);
  return { events, calls: call };
}

describe("watchChanges", () => {
  it("avisa só quando a assinatura muda (a primeira leitura é a base)", async () => {
    const { events } = await collect(["a", "a", "b", "b", "c"], { maxMs: 4000 });
    expect(events).toEqual([{ type: "change" }, { type: "change" }]);
  });

  it("manda um ping de tempos em tempos para a conexão não cair", async () => {
    const { events } = await collect(["a"], { maxMs: 31_000, heartbeatMs: 15_000 });
    expect(events).toEqual([{ type: "ping" }, { type: "ping" }]);
  });

  it("termina sozinho em maxMs (o navegador reconecta)", async () => {
    const { calls } = await collect(["a"], { maxMs: 5000 });
    expect(calls).toBe(6); // base + 5 conferências
  });

  it("para quando o banco falha (a tela volta ao polling)", async () => {
    const { events, calls } = await collect(["a", new Error("db fora")], { maxMs: 10_000 });
    expect(events).toEqual([]);
    expect(calls).toBe(2);
  });

  it("para quando o cliente fecha a conexão", async () => {
    const controller = new AbortController();
    controller.abort();
    const { calls } = await collect(["a", "b"], { maxMs: 10_000, signal: controller.signal });
    expect(calls).toBe(0);
  });
});
