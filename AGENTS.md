<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nexo Assist — convenções do projeto

- **Leia antes de mudar:** `docs/specs/` (o que o sistema faz) e `docs/specs/04-arquitetura.md` (onde cada coisa mora).
- **Toda mudança segue a skill `mudanca-sdd-tdd`:** spec → teste que falha → código → `npm run typecheck && npm run lint && npm test`.
- **Camadas:** `domain` não importa framework; `application` depende só de portas; rotas em `app/api` são finas (`handle` + `parseBody` + `requireUser` + um serviço).
- **Regras do service desk vão para código testado**, não para o prompt do agent.
- **Identidade vem da sessão** (`requireUser` / `TurnContext.employee`), nunca do corpo da requisição nem de argumento de tool.
- **Agent:** novas ações viram tools em `src/agent/tools/` que registram passos com `turn.recorder.step()`. Depois de mudar o agent, rode `npm run eval` (skill `ajustar-agent`).
- **UI:** shadcn/ui + Tailwind com os tokens de `globals.css`; estado do chat no Redux (`features/chat/chat-slice.ts`), console com RTK Query.
- **Docs atualizadas:** use o MCP Context7 para Mastra e libs; para o Next 16, `node_modules/next/dist/docs/`.
- **Commits:** pequenos, em português, `tipo(escopo): resumo`, com o porquê no corpo.
