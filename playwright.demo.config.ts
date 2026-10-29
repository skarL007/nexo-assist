import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Mesma configuração do E2E principal, mas o servidor do app sobe com PUBLIC_DEMO=1
// e um banco próprio, para provar o isolamento entre visitantes da demo pública.
const servers = Array.isArray(base.webServer) ? base.webServer : [];

export default defineConfig({
  ...base,
  testDir: "./e2e-demo",
  webServer: servers.map((server, index) =>
    index === 1
      ? { ...server, env: { ...server.env, PUBLIC_DEMO: "1", DATABASE_URL: "file:demo-e2e.db" } }
      : server,
  ),
});
