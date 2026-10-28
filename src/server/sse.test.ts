import { describe, expect, it } from "vitest";
import { sseResponse } from "./sse";

async function* events() {
  yield { type: "change" as const };
  yield { type: "ping" as const };
}

describe("sseResponse", () => {
  it("escreve no formato text/event-stream, com o tempo de reconexão", async () => {
    const response = sseResponse(events());
    expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("retry: 1000\n\nevent: change\ndata: {}\n\n: ping\n\n");
  });
});
