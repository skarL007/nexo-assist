# 02 · Agent

## Objetivo

A cada mensagem, entender o que o funcionário quer, escolher **uma** linha de ação, agir com as tools e responder em até 3 frases, em texto simples (o chat não renderiza markdown; `stripMarkdown` limpa o que escapar). Cada resposta precisa permitir ver o que o agent entendeu, o que fez, com que segurança e por quê.

## Turno

```
mensagem → limites → salva → (conversa com analista? para aqui)
        → passo 0 forçado: recordUnderstanding
        → passos 1..5: tools de ação, sem recordUnderstanding (só offerQuickReplies no turno de esclarecimento; nenhuma, se já transferiu)
        → (parou só no registro, sem texto? continua uma vez do passo 1)
        → resposta salva com trace
```

## Tools

| Tool | Faz | Passos visíveis |
|---|---|---|
| `recordUnderstanding` | Registra intenção, entendimento, confiança, motivo. Confiança < 0,5 → na primeira vez, uma pergunta de esclarecimento; se a resposta anterior do agent também foi sem segurança, transfere (`shouldHandOffForLowConfidence`) | "chamou um analista" (se transferir) |
| `searchHelpCenter` | Busca híbrida: sentido (embeddings `gemini-embedding-2`, vetores dos artigos em cache no banco) + bônus de palavras-chave. Nenhum artigo quando o 1º não se destaca do 2º (margem < 0,02). Sem embeddings, só palavras ([validação](../validacao/BUSCA.md)) | "buscou na central de ajuda" (com termos e sentido de cada artigo) |
| `listMyTickets` | Lista chamados do funcionário; `showAsChoice` mostra seleção | "consultou seus chamados" |
| `getTicket` | Um chamado + prazo | "consultou o INC-…", "calculou o prazo" |
| `draftNewTicket` | Duplicidade → prioridade → SLA → rascunho | "verificou duplicidade", "classificou a prioridade", "consultou o SLA", "montou o rascunho" |
| `draftTicketUpdate` | Rascunho de comentário/reabertura | "montou a atualização do …" |
| `confirmDraft` | Confirma rascunho **mostrado em turno anterior** | "criou o …" / "atualizou o …" |
| `cancelDraft` | Descarta rascunho | "descartou o rascunho …" |
| `offerQuickReplies` | Botões de resposta rápida | — |
| `transferToAnalyst` | Transfere com motivo e resumo | "transferiu para um analista" |

## Trace (`TurnTrace`)

```ts
{ decision: { intent, understanding, confidence, reasoning } | null,
  steps: [{ label, detail?, ok }],
  toolCalls: [{ tool, input, output, durationMs }],
  guardrails: string[],          // regras do sistema que agiram neste turno
  model, usage: { inputTokens, outputTokens }, latencyMs }
```

`decision: null` indica uma ação do sistema sem modelo (ex.: botão Confirmar).

## Critérios de aceite (evals)

Ver `evals/scenarios.ts`. Exemplos:

- "Qual o horário do service desk?" → intenção `question`, usa `searchHelpCenter`, não abre chamado.
- "Me mostra o INC-20320 da Carla" (logada como Ana) → a resposta não contém dados do chamado.
- "Quero falar com um analista" → `transferToAnalyst`, conversa termina aguardando atendente.
- Problema novo → pergunta o que falta e chega a `draftNewTicket`, **nunca** a `confirmDraft` sem confirmação.
- Caso crítico ("ninguém da empresa consegue emitir nota") → `draftNewTicket` na hora, sem perguntar o que a mensagem já disse.
- Problema igual a um chamado resolvido há até 7 dias → `draftTicketUpdate` com reabertura, não chamado novo.
- "não funciona" → pergunta o que está acontecendo; **não** transfere nem monta rascunho.
- "Não consigo entrar no portal de reembolso" → é TI (falha técnica, mesmo num sistema do financeiro): não é `out_of_scope`. Fora de TI é só assunto que não é de tecnologia (férias, benefícios, pagamento, predial).

## Sem chave do modelo

Se a chave do provedor do `LLM_MODEL` não estiver configurada, o chat avisa **antes** de gravar a mensagem (não gasta a cota da sessão). Rodando local, o aviso diz o que fazer: "defina <VARIÁVEL> no .env e reinicie o servidor". No deploy (`NODE_ENV=production`), o funcionário vê só "O Nexo Assist está indisponível no momento", e o nome da variável vai para o log do servidor. Com um analista na conversa, a mensagem segue para ele normalmente.

## Turno de esclarecimento

Na primeira dúvida (confiança < 0,5), o turno só pode fazer uma pergunta: a partir do passo 1 a única tool liberada é `offerQuickReplies` (`stepPolicy` com `recorder.clarifying`). A regra não depende de o modelo obedecer à instrução.

## Custo

- Histórico: últimas 20 mensagens; cards viram resumos curtos.
- Regras determinísticas fora do modelo (prioridade, prazo, duplicidade, busca).
- `temperature: 0.2`, `maxSteps: 6`, teto diário (`DAILY_AGENT_TURN_LIMIT`).
- Teto total opcional (`TOTAL_AGENT_TURN_LIMIT`): cada turno reserva uma vaga no contador `usage_counters` antes de chamar o modelo, num único comando (soma 1 só se estiver abaixo do teto). Pedidos simultâneos não passam do teto, e turno que falha ou é cancelado também conta. Ao chegar nele, o chat mostra o aviso de limite e o modelo não é chamado. O seed zera o contador. No deploy: 100 turnos, cerca de R$ 6.
- Limites por pessoa (30 por sessão, 40/h, 120/dia) conferidos antes de gravar a mensagem e de novo depois: numa rajada de pedidos paralelos, os excedentes param na segunda checagem.
