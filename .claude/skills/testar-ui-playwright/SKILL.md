---
name: testar-ui-playwright
description: Verifica telas do Nexo Assist no navegador com Playwright. Use antes de declarar uma mudança de interface pronta, para reproduzir bug visual ou para escrever um teste E2E novo.
---

# Testar a interface com Playwright

## Teste automatizado (E2E)

- Os testes ficam em `e2e/*.spec.ts`. Login e helpers estão em `e2e/helpers.ts`.
- `npm run test:e2e` recria o banco `e2e.db`, faz o build de produção e sobe na porta 3100.
- Os E2E **não chamam o LLM**. Para testar transferência, use as conversas do seed (Carla e Bruno já estão na fila).
- Prefira localizadores por papel e texto (`getByRole`, `getByLabel`, `getByText`) em vez de classes CSS.

## Inspeção manual com o MCP do Playwright

O `.mcp.json` registra o servidor `playwright`. Com `npm run dev` rodando:

1. Navegue até `http://localhost:3000/login` e entre com `ana.souza@nexo.com.br` (qualquer senha).
2. Tire um snapshot de acessibilidade para conferir textos e estados (carregando, erro, vazio).
3. Para o console, entre com `rafael.lima@nexo.com.br`.

Compare com o protótipo (Anexo C): layout das 5 telas, estados de carregamento e erro.
