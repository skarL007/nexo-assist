# Processo de desenvolvimento com IA

O desafio pede o uso de IA para programar. Este arquivo registra **como** ela foi usada e quais práticas sustentam o código, para que qualquer pessoa (ou outra IA) continue do mesmo jeito.

## Ferramentas

| O quê | Para quê | Onde está no projeto |
|---|---|---|
| **Claude Code** (agent de programação) | Gerar código em incrementos pequenos, sempre verificados por typecheck, lint e testes antes do commit | histórico do git |
| **MCP Context7** | Ler a documentação **atual** do Mastra (v1.79) e do Next.js 16 antes de usar as APIs: `createTool(input, context)`, `prepareStep` com `toolChoice`, chunks do `fullStream` | `.mcp.json` |
| **MCP Playwright** | Abrir a aplicação no navegador, conferir as telas com o protótipo e reproduzir bugs visuais | `.mcp.json`, skill `testar-ui-playwright` |
| **Playwright Test** | E2E: login, permissões e o ciclo da transferência, contra o build de produção | `e2e/`, `playwright.config.ts` |
| **Skills do projeto** | Roteiros que a IA (ou a pessoa) segue para mudar o projeto sem quebrar as garantias | `.claude/skills/` |
| **Docs locais do Next 16** | O Next 16 mudou APIs (`cookies()` assíncrono, `params` como Promise, `cacheComponents`); a referência é `node_modules/next/dist/docs/` | `AGENTS.md` |

## Práticas

### TDD
As regras do service desk nasceram com testes junto: prazo em horas úteis, matriz de prioridade, máquina de estados da conversa, privacidade, reabertura, duplicidade, retry do legado, confirmação obrigatória e transferência em caso crítico. São 47 testes unitários (`npm test`) e 6 E2E (`npm run test:e2e`). Os commits mostram teste e código entrando juntos, camada por camada.

### SDD
As especificações estão em `docs/specs/`. No primeiro ciclo, foram consolidadas a partir do PRD do desafio enquanto o código e os testes eram escritos. **A partir de agora, toda mudança começa pela spec** (skill `mudanca-sdd-tdd`): spec → teste que falha → código → verificação.

### Evals do agent
Teste unitário não prova que o LLM decide bem. `npm run eval` roda 10 conversas reais e confere intenção, ferramentas esperadas e proibidas, transferência e vazamento de dados de outra pessoa.

### Regras em código, não no prompt
Tudo o que precisa ser garantido (prioridade, prazo, confirmação, privacidade, transferência por baixa confiança) está em código testável. O prompt cuida só do jeito de conversar.

## Decisões tomadas durante o desenvolvimento

| Decisão | Motivo |
|---|---|
| Gemini 3.5 Flash em vez de OpenAI | Saldo disponível no Google; o roteador do Mastra troca o provedor por variável de ambiente |
| Histórico próprio em vez da memória do Mastra | O console do analista lê e escreve na mesma conversa; uma tabela `messages` é a fonte da verdade |
| Stream NDJSON próprio em vez do `useChat` | O estado do chat fica no Redux Toolkit (pedido do projeto), e os eventos `step`/`card` mostram as ações em tempo real |
| `cacheComponents` desligado | As páginas dependem do cookie de sessão; o modelo clássico de renderização dinâmica é mais simples de estudar |
| Polling no console | Funciona em serverless (Vercel) sem infraestrutura extra |
