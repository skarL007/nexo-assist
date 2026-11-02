import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Documentação viva: os mesmos servidores do E2E principal (build de produção, banco do seed),
 * mas os testes de e2e-docs/ percorrem as telas e salvam capturas em docs/capturas/. Cada captura
 * só é salva depois de conferir o que a tela mostra: imagem desatualizada vira teste vermelho.
 *
 *   npm run docs:capturas
 */
const servers = Array.isArray(base.webServer) ? base.webServer : [];

export default defineConfig({
  ...base,
  testDir: "./e2e-docs",
  webServer: servers.map((server, index) => (index === 1 ? { ...server, env: { ...server.env, DATABASE_URL: "file:docs-e2e.db" } } : server)),
});
