import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o build de produção, num banco separado (e2e.db) recriado a cada execução.
 * Os testes não chamam o LLM: cobrem login, permissões e o ciclo da transferência.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run db:setup && npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "file:e2e.db",
      AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      LEGACY_FAILURE_RATE: "0",
    },
  },
});
