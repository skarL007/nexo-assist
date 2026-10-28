# 04 · Arquitetura

DDD enxuto, com quatro camadas e uma regra: **a dependência aponta para dentro**.

```
            app/ (rotas e páginas)      features/ + components/ (UI)
                    │                              │
        ┌───────────┴───────────┐            contracts/ (tipos da API)
        ▼                       ▼                  │
     agent/                server/                 │
        │                       │                  │
        └──────────┬────────────┘                  │
                   ▼                               │
             application/  ── portas ──▶ infrastructure/ (implementa)
                   │                               │
                   └──────────────▶ domain/ ◀──────┘
```

| Camada | Pode importar | Não pode importar |
|---|---|---|
| `domain` | nada além de si | Next, Mastra, Drizzle, Zod do servidor |
| `application` | `domain`, `lib` | `infrastructure`, `agent`, Next |
| `infrastructure` | `application` (portas), `domain`, `config` | `agent`, UI |
| `agent` | `application`, `domain`, `infrastructure/container` | UI |
| `app` (rotas) | tudo do servidor | — |
| `features`/`components` | `contracts`, `domain` (só tipos e rótulos), `lib` | `infrastructure`, `agent`, `server` |

## Onde mexer para…

| Quero… | Arquivo |
|---|---|
| Mudar uma regra de prioridade ou prazo | `domain/priority.ts` (+ teste) |
| Nova categoria de chamado | `domain/ticket.ts` (`CATEGORIES` e `CATEGORY_LABEL`) |
| Nova ação do agent | nova tool em `agent/tools/`, registrar em `agent/tools/index.ts` |
| Mudar o tom ou o roteiro do agent | `agent/instructions.ts` |
| Novo campo no chamado | `domain/ticket.ts` → `infrastructure/db/schema.ts` → `npm run db:generate` → seed |
| Novo card na conversa | tipo em `domain/message.ts` (`Card`) → componente em `components/conversation/cards/` → `message-cards.tsx` |
| Nova rota | `app/api/...`, usando `handle`, `parseBody` e `requireUser` |

## Banco na imagem Docker

A imagem Docker (`Dockerfile`) não tem `tsx`, então o preparo do banco roda num script empacotado (`scripts/docker-init.ts`) antes do servidor subir. A regra mora em `infrastructure/db/bootstrap.ts`:

- aplica as migrações da pasta `drizzle` toda vez que o contêiner sobe;
- cria os dados de exemplo só se a tabela `employees` estiver vazia (primeiro start num volume novo);
- com `SEED_IF_EMPTY=0`, nunca cria os dados de exemplo.

Critério de aceite: banco vazio → migra e cria os dados (`seeded: true`); segunda execução no mesmo banco → não recria nada e mantém o que já existia (`seeded: false`); banco vazio com o seed desligado → só migra.
