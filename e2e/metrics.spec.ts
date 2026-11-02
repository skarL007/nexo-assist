import { expect, test } from "@playwright/test";

/** /api/metrics no build de produção: só o Bearer do Prometheus lê, no formato de texto dele. */
const TOKEN = "e2e-metrics-token-e2e-metrics";

test("sem o token, ou com outro, o Prometheus não lê nada", async ({ request }) => {
  expect((await request.get("/api/metrics")).status()).toBe(401);
  expect((await request.get("/api/metrics", { headers: { Authorization: "Bearer outro-token-qualquer" } })).status()).toBe(401);
});

test("com o token, devolve as séries do agent e do processo no formato do Prometheus", async ({ request }) => {
  const response = await request.get("/api/metrics", { headers: { Authorization: `Bearer ${TOKEN}` } });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const body = await response.text();
  for (const series of ["nexo_agent_turns_total counter", "nexo_retrieval_total counter", "nexo_tool_duration_seconds histogram", "nexo_process_cpu_seconds_total counter"]) {
    expect(body).toContain(`# TYPE ${series}`);
  }
});
