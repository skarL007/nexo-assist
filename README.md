# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema com as próprias palavras e o agent consulta os chamados dele, busca na central de ajuda, abre ou atualiza chamados (sempre com confirmação) e chama um analista quando precisa. O analista atende pelo console: vê a fila, assume a conversa com o agent pausado e depois devolve ou encerra.

**Stack:** TypeScript estrito · Next.js 16 (App Router) · Mastra (agent) · Google Gemini · Drizzle + libSQL (SQLite local / Turso no deploy) · Redux Toolkit + RTK Query · Zod · shadcn/ui + Tailwind · Vitest · Playwright.

---

## Como rodar

Pré-requisitos: Node 22+ e uma chave do Gemini ([Google AI Studio](https://aistudio.google.com/apikey)).

```bash
npm install
cp .env.example .env          # preencha GOOGLE_GENERATIVE_AI_API_KEY
npm run db:setup              # cria o banco local (local.db) e os dados de exemplo
npm run dev                   # http://localhost:3000
```

Qualquer senha funciona para os usuários de exemplo:

| Quem | E-mail | Para ver |
|---|---|---|
| Ana Souza (funcionária) | `ana.souza@nexo.com.br` | 3 chamados abertos, 1 vencido (INC-20311), 1 resolvido há 4 dias (pode reabrir) |
| Elisa Prado (funcionária) | `elisa.prado@nexo.com.br` | conversa em andamento com o agent |
| Rafael Lima (analista N2) | `rafael.lima@nexo.com.br` | console com 2 conversas na fila |

Outros comandos:

```bash
npm test              # testes unitários (domínio, serviços, filtros) — sem LLM
npm run test:e2e      # Playwright contra o build de produção — sem LLM
npm run eval          # 10 cenários de decisão do agent com o modelo real
npm run db:seed       # volta os dados ao estado inicial
npm run typecheck && npm run lint
```

---

## Arquitetura

```
src/
├── domain/           Regras puras do service desk (sem banco, sem rede, sem framework)
├── application/      Casos de uso: serviços de chamados, conversas e rascunhos + portas (interfaces)
├── infrastructure/   Banco (Drizzle), repositórios, legado instável simulado, composição
├── agent/            Agent Mastra: instruções, tools, orquestração de um turno
├── server/           Sessão (JWT em cookie), helpers HTTP, montagem das respostas da API
├── contracts/        Tipos e schemas Zod compartilhados entre servidor e browser
├── app/              Páginas e rotas do Next.js (finas: validam, chamam um serviço, respondem)
├── features/         Telas: chat (slice Redux + stream), console (RTK Query), login
└── components/       UI compartilhada: mensagens, cards, trace, shadcn/ui
```

A dependência só aponta para dentro: `app → agent/application → domain`. O domínio não conhece Next, Mastra nem banco, e por isso as regras (prioridade, prazo, reabertura, transições) são testadas sem mock. A aplicação depende de **portas** (`application/ports.ts`), e a infraestrutura as implementa. Só um arquivo liga as peças: `infrastructure/container.ts`.

**Serviço de chamados separado do agent.** O agent não toca no banco. As tools chamam o `TicketService`, que é o mesmo serviço usado pelas rotas e pelos botões. O "sistema legado" é um *decorator* (`FlakyTicketRepository`) que falha aleatoriamente (`LEGACY_FAILURE_RATE`, 15% por padrão). O serviço tenta de novo com backoff (200 ms, 400 ms), e cada nova tentativa aparece no trace como "sistema de chamados instável".

**Persistência.** Conversas, mensagens (com cards e trace), rascunhos, chamados e o estado de cada conversa ficam no SQLite/Turso e sobrevivem a um restart. Ao voltar outro dia, o funcionário cai na conversa aberta dele.

**Tempo real.** `POST /api/chat` responde em NDJSON (um evento JSON por linha): `employee_message`, `step` ("consultou seus chamados"), `card`, `text` (tokens) e `done`. O thunk do Redux lê o stream e despacha cada evento. Mensagens do analista chegam por polling (4 s), o que basta para a escala do desafio e não exige WebSocket na Vercel.

---

## Como o agent decide

Cada mensagem do funcionário vira um **turno** (`agent/run-turn.ts`):

1. **Limites:** 30 mensagens por sessão e um teto diário de respostas (proteção de custo).
2. **Pausa:** se a conversa está com um analista, a mensagem é salva e o agent não é chamado.
3. **Entendimento obrigatório:** o primeiro passo do modelo é *forçado* (`prepareStep` + `toolChoice`) a chamar `recordUnderstanding`, com intenção, o que entendeu, confiança (0–1) e motivo. Daí sai o painel "por quê?" de cada resposta.
4. **Ação:** o modelo escolhe as tools pela intenção (dúvida → central; consulta → chamados; problema novo → perguntas e rascunho; analista → transferência). No máximo 6 passos.
5. **Registro:** a resposta é salva com o trace completo: decisão, passos visíveis, chamadas de tool cruas (entrada/saída/tempo), regras do sistema que agiram, modelo, tokens e latência.

### O que é garantido em código (não depende do prompt)

| Regra (Anexo A) | Onde |
|---|---|
| Prioridade = impacto × urgência (o modelo informa os dois, o código calcula) | `domain/priority.ts` |
| Prazo em horas/dias úteis (seg–sex, 8h–18h; crítico 1h corrida) | `domain/business-time.ts` |
| Só cria/atualiza depois da confirmação: o agent monta rascunho; `confirmDraft` recusa rascunho criado no mesmo turno | `application/draft-service.ts` |
| Sem duplicidade: antes do rascunho, procura aberto ou resolvido há ≤7 dias da mesma categoria | `TicketService.findPossibleDuplicates` |
| Reabrir só até 7 dias | `domain/ticket.ts` (`canReopen`) |
| Confiança < 50% → transfere sozinho | `agent/tools/understanding.ts` |
| Chamado crítico confirmado → transfere sozinho | `DraftService.confirm` |
| Agent mudo com analista; depois de transferir não chama mais tools | `run-turn.ts` (`agentCanReply`, `toolChoice: "none"`) |
| Privacidade: o funcionário vem do cookie assinado, nunca de argumento do modelo; chamado alheio responde "não encontrado" | `agent/turn-context.ts`, `TicketService.getMine` |

O prompt (`agent/instructions.ts`) cuida só da conversa: perguntar uma coisa por vez, oferecer respostas rápidas, não repetir o que o card mostra e redirecionar o que não é de TI.

### Como garanti a qualidade das decisões

- **Testes de regra (Vitest, 47):** prazos com fim de semana, matriz de prioridade, máquina de estados, privacidade, reabertura, duplicidade, retry do legado, confirmação obrigatória, transferência em caso crítico.
- **E2E (Playwright, 6):** login, permissões (funcionário não acessa console nem API do analista) e o ciclo da transferência ponta a ponta.
- **Evals (`npm run eval`):** 10 conversas reais com o modelo, conferindo intenção, ferramentas esperadas e proibidas, transferência e vazamento de dados de outra pessoa.
- **Trace em toda resposta:** dá para auditar cada decisão na própria interface (e no console do analista).

---

## Escolha do modelo

**Gemini 3.5 Flash** (`google/gemini-3.5-flash`): tool calling confiável (inclusive a escolha forçada de tool no primeiro passo), latência baixa e custo por conversa de frações de centavo. A troca de modelo é uma variável (`LLM_MODEL`), graças ao roteador de modelos do Mastra. Para usar OpenAI, por exemplo, basta `LLM_MODEL=openai/gpt-4.1-mini` com `OPENAI_API_KEY`, ajustando a checagem de chave em `run-turn.ts`.

**Custo consciente:** o histórico enviado ao modelo tem no máximo 20 mensagens, e os cards viram resumos curtos entre colchetes. Prioridade, prazo, duplicidade e busca na central são código, sem gastar token. A temperatura é 0.2 e o limite é de 6 passos por turno.

---

## Deploy (Vercel + Turso)

1. Crie o banco: `turso db create nexo-assist`, depois pegue a URL (`turso db show nexo-assist --url`) e um token (`turso db tokens create nexo-assist`).
2. Aplique o schema e os dados apontando para o Turso:
   ```bash
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:setup
   ```
3. Na Vercel, importe o repositório e configure as variáveis: `GOOGLE_GENERATIVE_AI_API_KEY`, `LLM_MODEL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET` (32+ caracteres aleatórios) e `DAILY_AGENT_TURN_LIMIT`.
4. Proteção contra abuso: 30 mensagens por sessão, teto diário global de respostas do agent (`DAILY_AGENT_TURN_LIMIT`), login obrigatório para chegar ao LLM e chaves só no servidor. Recomendo também um limite de gasto no projeto do Google Cloud.

---

## Trade-offs

- **Polling em vez de WebSocket/SSE** para as mensagens do analista: simples e compatível com serverless. O custo é uma latência de até 4 s.
- **Busca por palavras-chave** na central: com 9 artigos, é grátis e explicável (o trace mostra os termos que bateram). Com centenas de artigos, eu trocaria por embeddings sem mudar quem chama.
- **Duplicidade por categoria** e a decisão final com o modelo: barato e transparente, mas pode sugerir um chamado não relacionado da mesma categoria (o funcionário escolhe "não é nenhum desses").
- **Histórico próprio em vez da memória do Mastra:** o console do analista precisa ler e escrever na mesma conversa, então mantive uma única tabela `messages` como fonte da verdade.
- **Login sem senha real**, como pede o desafio: a sessão é um JWT assinado em cookie httpOnly, então a troca para SSO corporativo fica isolada em `server/session.ts`.

## O que eu faria com mais tempo

- Eventos em tempo real (SSE) para o console e o chat do analista.
- Busca semântica na central e detecção de duplicidade por similaridade de texto.
- Evals rodando no CI com limiar mínimo e histórico de resultados por versão do prompt.
- Rate limit por usuário e IP (ex.: Upstash) além do teto global.
- Métricas do painel: taxa de resolução sem fila, tempo até a primeira resposta, motivos de transferência.

## Documentação

- [`docs/specs/`](docs/specs): especificações (SDD) de regras, agent, conversa/console e arquitetura.
- [`docs/PROCESSO-IA.md`](docs/PROCESSO-IA.md): como IA, MCPs, skills, TDD e SDD foram usados.
- [`AGENTS.md`](AGENTS.md) e [`.claude/skills/`](.claude/skills): convenções e roteiros para quem (ou qual IA) for alterar o projeto.
