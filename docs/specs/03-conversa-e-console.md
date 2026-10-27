# 03 · Conversa, transferência e console

## Estados da conversa

```
with_agent ──handoff──▶ waiting_analyst ──assume──▶ with_analyst
     ▲                        │                          │
     └────────── release ◀────┴──────────────────────────┘
(qualquer estado aberto) ──close──▶ closed
```

- O agent só responde em `with_agent`. Nos outros estados, a mensagem do funcionário é salva e fica para o analista.
- Toda transição gera uma mensagem de sistema (a divisória no histórico).
- A transferência leva **motivo** (pedido do funcionário, caso crítico, chamado vencido, baixa confiança), **resumo** e, se houver, o chamado relacionado.

## Login

- Entram só as pessoas dos dados de exemplo, com qualquer senha não vazia (Tela 1 do PDF). Não há cadastro.
- Os botões de demonstração ("Ana · funcionária", "Rafael · analista") entram com um clique.
- Senha vazia mostra "Informe uma senha (na demonstração, qualquer uma funciona)". "Esqueci minha senha" explica o mesmo.

## Sessão

- Uma conversa aberta por funcionário. Ao voltar, ele continua nela (história 6).
- Limite: 30 mensagens do funcionário por conversa. "Nova conversa" encerra a atual.

## Console do analista

- **Filtros:** Todas · Para você (aguardando atendente) · Com o agent · Minhas (assumidas por mim). Busca por nome, chamado ou texto.
- **Ordem:** fila primeiro (quem espera há mais tempo no topo) e depois por recência.
- **Linha de estado:** "Agent pediu ajuda · confiança 41%", "Transferida há 25 minutos", "Agent atendendo", "Você está atendendo".
- **Conversa:** resumo da transferência no topo e histórico com o trace do agent. Ações: Assumir; Devolver ao agent; Encerrar. Só quem assumiu pode responder.
- **Painel:** chamados do funcionário, com o da transferência em destaque.

## API

| Método | Rota | Quem | Faz |
|---|---|---|---|
| POST | `/api/auth/login` | todos | `{ email, password }` → cookie de sessão |
| POST | `/api/auth/logout` | todos | apaga a sessão |
| GET | `/api/chat` | funcionário | conversa aberta (ou vazia) |
| POST | `/api/chat` | funcionário | `{ text }` → stream NDJSON |
| POST | `/api/chat/new` | funcionário | encerra a conversa atual |
| POST | `/api/chat/drafts/:id` | funcionário | `{ action: confirm \| cancel }` |
| GET | `/api/console/conversations` | analista | lista |
| GET | `/api/console/conversations/:id` | analista | detalhe + chamados |
| POST | `/api/console/conversations/:id` | analista | `{ action: assume \| release \| close }` |
| POST | `/api/console/conversations/:id/messages` | analista | `{ text }` |

Erros sempre no formato `{ error: string, code?: string }`. Regras de negócio viram 404/403/409/429/503 (`server/http.ts`).
