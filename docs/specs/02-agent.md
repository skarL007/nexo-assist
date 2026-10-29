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
- Rascunho na tela + resposta rápida que não confirma ("Tenho alternativa / Posso aguardar") → nenhum chamado criado.
- "Outlook não abre" com o INC-20311 (notebook lento) aberto → rascunho de chamado novo de E-mail, nunca atualização do INC-20311. O mesmo depois de uma mensagem vaga ("tudo travado aqui").
- Incidente "sem urgência" sem nada dito sobre alternativa → o `draftNewTicket` não monta o rascunho e mostra "Tenho alternativa / Não tenho alternativa" (regra em `domain/workaround.ts`, ver [01](./01-regras-do-service-desk.md#alternativa-antes-da-prioridade)); com "Tenho alternativa", o rascunho sai Média, não Baixa.

### Como os runners de eval lidam com limites, falhas e bancos

- **Erro inteiro no log.** Quando uma tentativa falha, `npm run eval` e `npm run eval:sim` imprimem a mensagem completa e a cadeia de `cause` (nome, mensagem e código de cada nível), sem cortar em N caracteres. Aceite: um erro `Failed query: insert into "messages" ...` com `cause` `SQLITE_BUSY` aparece no log com os dois (`evals/describe-error.test.ts`).
- **Cada execução do funcionário simulado parte do seed.** O pass^k pressupõe k tentativas da mesma tarefa. Sem reset, o chamado que a execução #1 abre fica no banco, e nas execuções #2 e #3 o agent (corretamente) o trata como duplicado e atualiza em vez de abrir outro, então "1 chamado novo" reprova por causa do teste e não do agent. Antes de cada execução, `npm run eval:sim` devolve o `eval-sim.db` ao seed (`evals/sim/reset.ts`, que usa `seedDemoData`): chamados, conversas, mensagens, rascunhos e contadores de uso. Aceite: um chamado aberto, um chamado do seed alterado e uma conversa nova somem depois do reset, e o resto do seed volta igual (`evals/sim/reset.test.ts`).
- **Janela de mensagens limpa.** O app recusa mais de 40 mensagens por hora e 120 por dia de cada pessoa (`message_limit`). Os evals jogam todos os cenários com os mesmos funcionários do seed no mesmo banco, então sem cuidado os últimos cenários bateriam nesse limite e o resultado não diria nada sobre o agent. Antes de cada cenário (eval e benchmark; o sim já parte do seed) o runner recua a data das mensagens recentes daquela pessoa no banco do eval, que é descartável (`evals/message-window.ts`). Nada é apagado, e o limite de produção em `src/` não muda. Aceite: uma pessoa com 45 mensagens na última hora e 130 no último dia passa a contar 0 nas duas janelas; as mensagens de outra pessoa, as mais antigas que um dia e a ordem das mensagens da conversa não mudam (`evals/message-window.test.ts`).
- **Só falha do provedor é repetida.** `npm run eval` e `npm run eval:sim` repetem o cenário (até 3 vezes) e contam "erro do provedor" apenas quando a falha vem do modelo: erro de API com status 408, 429 ou 5xx (ou `isRetryable`), erro de rede ou de tempo esgotado, ou um turno sem uso do modelo (o Mastra engole o 503 e o turno sai com a resposta reserva). Erro de regra do app (`DomainError`, como `message_limit`), erro de banco e qualquer erro que não seja reconhecido como do provedor **não** são repetidos nem contados como do provedor: o runner para na hora e escreve o motivo real (nome do cenário, mensagem inteira e `cause`). No benchmark, erro de regra ou de banco também aborta o candidato em vez de virar "erro técnico" do modelo. Aceite: um `DomainError("message_limit", ...)` durante o cenário → 1 tentativa, 0 erros do provedor, parada com a mensagem "Você enviou muitas mensagens em pouco tempo..."; um 503 → repete e só então conta como erro do provedor (`evals/provider-errors.test.ts`).
- **Um banco por eval.** `npm run eval` usa `eval.db`, `npm run eval:sim` usa `eval-sim.db` e `npm run eval:sugestao` usa `eval-sugestao.db`, cada um recriado com migração e seed antes de rodar, então nenhum disputa o arquivo do outro (o benchmark já tem um banco por candidato). Os `*.db` ficam fora do git. Aceite: os três runners apontam para arquivos diferentes (`evals/db-isolation.test.ts`).

## Confirmação só explícita

Um chamado nasce só pelo botão Confirmar ou por uma mensagem que confirma sem ambiguidade. `confirmDraft` passa o texto da última mensagem do funcionário (`TurnContext.employeeText`, vindo do turno, nunca de argumento da tool) e o `DraftService` recusa a confirmação pelo agent quando `isExplicitConfirmation` (`domain/confirmation.ts`) não reconhece um "pode criar". A regra é código: vale mesmo que o modelo entenda outra coisa como "sim". Conta como confirmação: "sim", "pode criar", "pode abrir o chamado", "confirmo", "ok, pode mandar", "isso mesmo, pode abrir", "está certo". Não conta: resposta a outra pergunta ou clique em resposta rápida ("Tenho alternativa / Posso aguardar", "Só eu"), pergunta ("posso criar depois?"), hesitação ou pedido de mudança ("sim, mas muda a prioridade", "não", "espera", "ainda não"). Achado do funcionário simulado de 28/10 (`power-bi`): com o rascunho na tela, a resposta rápida de urgência virou "sim" e o REQ foi criado. Aceite: `domain/confirmation.test.ts`, `application/draft-service.test.ts` ("Tenho alternativa / Posso aguardar" → `confirmation_required`, nenhum chamado criado; "pode criar" → criado) e o eval "Confirmação: resposta rápida de urgência não confirma o rascunho".

**Resposta de identificação não confirma** (achado do eval "Reabrir chamado resolvido", 28/10): quando o agent pergunta "é este chamado?" e já mostra o rascunho de atualização, "Sim, é esse mesmo" responde à pergunta, não confirma a reabertura. Mensagem que só identifica o chamado ("é esse mesmo", "é este", "é ele", "é o mesmo") sem um pedido de ação ("pode reabrir", "confirmo") não confirma. E, quando a mensagem do turno não é uma confirmação explícita, o `confirmDraft` nem fica disponível para o modelo naquele turno (`stepPolicy`); a recusa do `DraftService` continua como segunda barreira. Aceite: `domain/confirmation.test.ts` ("Sim, é esse mesmo" → não confirma; "sim, é esse, pode reabrir" → confirma), `agent/step-policy.test.ts` e o eval "Reabrir chamado resolvido".

## Analista só quando o prazo não atende

Decisão de produto (achado do `vpn-reuniao` de 28/10): o agent oferece um analista por causa de prazo só quando o prazo do chamado (SLA) não atende a urgência que o funcionário informou, por exemplo uma reunião antes do vencimento. `getTicket` e `draftNewTicket` recebem `neededBy` ("HH:MM" de hoje, "DD/MM" ou "DD/MM HH:MM", horário de Brasília) quando o funcionário disse até quando precisa. O código compara (`deadlineMeetsNeed` em `domain/sla-need.ts`; "DD/MM" sem hora vale até as 18h):

- prazo depois da necessidade → o turno oferece um analista (botão "Falar com um analista", posto pelo código) e o trace registra o guardrail;
- prazo até a necessidade, ou necessidade não informada → o agent não oferece analista por prazo: o código tira o botão de analista das respostas rápidas do turno e registra o guardrail.

Continuam valendo as outras ofertas: chamado vencido, frustração e pedido explícito do funcionário ("quero falar com alguém" sempre transfere). **Sem um desses motivos, nada de oferta** (achado do `senha-sap` de 28/10: depois de reabrir o chamado, o agent ofereceu analista "se precisar de prioridade imediata"): o código tira o botão de analista das respostas rápidas quando o turno não tem motivo (prazo que não atende, chamado vencido consultado no turno ou frustração), e as instruções proíbem o convite no texto sem motivo. Aceite: `domain/sla-need.test.ts` (prazo quinta 11h e reunião quarta 15h → não atende; prazo quinta 11h e necessidade 06/11 → atende; sem necessidade → atende) e os evals "Prazo atende a necessidade: não oferece analista" e "Prazo não atende a necessidade: oferece analista".

## Sem chave do modelo

Se a chave do provedor do `LLM_MODEL` não estiver configurada, o chat avisa **antes** de gravar a mensagem (não gasta a cota da sessão). Rodando local, o aviso diz o que fazer: "defina <VARIÁVEL> no .env e reinicie o servidor". No deploy (`NODE_ENV=production`), o funcionário vê só "O Nexo Assist está indisponível no momento", e o nome da variável vai para o log do servidor. Com um analista na conversa, a mensagem segue para ele normalmente.

## Turno de esclarecimento

Na primeira dúvida (confiança < 0,5), o turno só pode fazer uma pergunta: a partir do passo 1 a única tool liberada é `offerQuickReplies` (`stepPolicy` com `recorder.clarifying`). A regra não depende de o modelo obedecer à instrução.

## Modelo reserva

Se o modelo principal (`LLM_MODEL`) falhar num passo (ex.: Gemini 3.5 Flash com 503 "alta demanda"), o Mastra tenta de novo uma vez e, se continuar falhando, faz o passo no **modelo reserva** (`LLM_FALLBACK_MODEL`, padrão `google/gemini-3.5-flash-lite`). O turno segue no reserva até o fim. O trace registra o modelo que respondeu (`model`), o que falhou (`fallbackFrom`) e um guardrail explicando a troca; o custo nos indicadores usa o preço do modelo que respondeu. Sem a chave do reserva, ou com `LLM_FALLBACK_MODEL=off`, não há reserva. O uso de tokens é somado passo a passo (o total do stream perde os campos depois de uma nova tentativa). Aceite: `agent/model-fallback.test.ts` (cadeia de modelos, leitura do passo e nota do trace) e, com o modelo real, um turno com o principal indisponível termina respondido pelo reserva e com o trace dizendo isso.

## Incidente em massa

Ao montar um rascunho de chamado novo, o sistema confere se **3 ou mais outras pessoas** abriram incidentes (INC) da mesma categoria, com uma palavra relevante do título em comum, nas **últimas 4 horas úteis** (`domain/known-issue.ts`). Se sim, o impacto "só eu" sobe para "equipe", a prioridade é recalculada pela matriz e o trace registra o guardrail. A tool devolve só categoria, quantas pessoas e desde quando: nada de nomes ou números de chamados de outras pessoas. O agent diz que é um problema conhecido e já acompanhado. O console mostra o banner "Possível incidente em massa". Aceite: eval "Incidente em massa: sistema de ponto fora do ar" (seed com 3 pessoas): rascunho com impacto `team`, resposta sem "Gustavo", "Helena", "Igor" ou os códigos deles. Com 2 pessoas, ou fora da janela, nada muda (teste unitário).

## Sinal de frustração

`recordUnderstanding` registra também `frustration` (`none`, `some` ou `high`) e o motivo. A regra é código (`domain/frustration.ts`): frustração alta, ou moderada em dois turnos seguidos, faz o agent **oferecer** um analista, continuando a ajudar. Ele não transfere sozinho por isso, e a frustração nunca muda a prioridade. O funcionário não vê o rótulo. O console mostra o chip "Frustração alta" (texto, não só cor), põe esses casos primeiro entre os de mesmo status, e o relatório traz o motivo. Aceite: "minha VPN caiu de novo, é a terceira vez essa semana, isso é um absurdo" registra `high` e a resposta oferece um analista sem transferir; "Qual o horário do service desk?" registra `none` e não oferece.

## Custo

- Histórico: últimas 20 mensagens; cards viram resumos curtos.
- Regras determinísticas fora do modelo (prioridade, prazo, duplicidade, busca).
- `temperature: 0.2`, `maxSteps: 6`, teto diário (`DAILY_AGENT_TURN_LIMIT`).
- Teto total opcional (`TOTAL_AGENT_TURN_LIMIT`): cada turno reserva uma vaga no contador `usage_counters` antes de chamar o modelo, num único comando (soma 1 só se estiver abaixo do teto). Pedidos simultâneos não passam do teto, e turno que falha ou é cancelado também conta. Ao chegar nele, o chat mostra o aviso de limite e o modelo não é chamado. O seed zera o contador. No deploy: 100 turnos, cerca de R$ 6.
- Limites por pessoa (30 por sessão, 40/h, 120/dia) conferidos antes de gravar a mensagem e de novo depois: numa rajada de pedidos paralelos, os excedentes param na segunda checagem.
