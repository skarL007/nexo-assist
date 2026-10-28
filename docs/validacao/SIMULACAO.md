# Funcionário simulado (pass^k)

**Pergunta:** o agent leva a conversa ao estado certo de forma consistente, quando quem conversa é uma pessoa que não conta tudo de uma vez, muda de ideia ou só quer um humano?

**Resposta:** depois das correções, quase sempre. A primeira rodada de 28/10/2026 (6 personas × 3) deu **pass^1 0,72 e pass^3 0,50** e apontou quatro comportamentos do agent. Com as correções em código e 4 personas novas, a rodada de 10 personas × 3 deu **pass^1 0,93 e pass^3 0,80** (28 de 30 conversas), por **US$ 2,33**. Uma das duas falhas era erro da própria checagem: corrigida a checagem e repetida só essa persona, ela passou 3 de 3, e a média fica em **0,97 / 0,90**. A falha que sobrou (`outlook-direto` #2) é de prioridade e está explicada abaixo.

## Antes e depois

| | Rodada 1 (antes) | Rodada 2 (depois) |
|---|---|---|
| Personas × execuções | 6 × 3 = 18 conversas | 10 × 3 = 30 conversas |
| pass^1 | 0,72 (13/18) | 0,93 (28/30) na rodada inteira · 0,97 com o `power-bi-urgencia` repetido depois de corrigir a checagem |
| pass^3 | 0,50 (3 de 6 personas) | 0,80 (8 de 10) na rodada inteira · 0,90 (9 de 10) com a repetição |
| Custo | US$ 1,19 | US$ 2,33 + US$ 0,29 da repetição |
| Mesmas 6 personas da rodada 1 | 0,72 / 0,50 | **1,00 / 1,00** (18/18) |

Por persona (k = 3):

| Persona | O que ela testa | Antes pass^1 / pass^3 | Depois pass^1 / pass^3 | Turnos | Perguntas | Custo/conversa |
|---|---|---|---|---|---|---|
| `vpn-reuniao` | VPN com erro 809 e reunião às 15h; INC de rede, prioridade alta; analista só se o prazo não atender a reunião | 0,33 / 0,00 | 1,00 / 1,00 | 6,7 | 1,7 | US$ 0,101 |
| `horario` | só quer o horário; nenhum chamado | 1,00 / 1,00 | 1,00 / 1,00 | 2,3 | 0,3 | US$ 0,033 |
| `power-bi` | pede o Power BI Desktop; REQ de software, baixa ou média | 0,67 / 0,00 | 1,00 / 1,00 | 5,3 | 1,3 | US$ 0,076 |
| `vago-outlook` | começa com "nada funciona aqui!!"; INC de e-mail, média, sem mexer no INC-20311 | 0,33 / 0,00 | 1,00 / 1,00 | 7,3 | 1,7 | US$ 0,136 |
| `muda-de-ideia` | desiste quando o rascunho aparece; nenhum chamado | 1,00 / 1,00 | 1,00 / 1,00 | 4,7 | 2,0 | US$ 0,103 |
| `quer-pessoa` | quer um analista desde a primeira mensagem | 1,00 / 1,00 | 1,00 / 1,00 | 1,0 | 0,0 | US$ 0,018 |
| `power-bi-urgencia` (nova) | clica na resposta rápida de urgência com o rascunho na tela, antes de confirmar | — | 0,67 / 0,00 na rodada (falha da checagem) · 1,00 / 1,00 repetida | 4,7 | 0,7 | US$ 0,071 |
| `outlook-direto` (nova) | "o outlook nao abre"; diz "acho que sim" se o agent sugerir um chamado antigo; INC de e-mail, média, sem mexer no INC-20311 | — | 0,67 / 0,00 | 6,0 | 1,7 | US$ 0,102 |
| `prazo-atende` (nova) | pede um headset e pergunta se chega até 06/11; o prazo atende, então nada de oferecer analista | — | 1,00 / 1,00 | 5,0 | 0,7 | US$ 0,076 |
| `senha-sap` (nova) | senha do SAP bloqueou de novo; atualiza e reabre o INC-20150, nenhum chamado novo | — | 1,00 / 1,00 | 4,7 | 0,7 | US$ 0,062 |

Nenhuma conversa vazou dado de outra pessoa, nas duas rodadas.

## O que foi corrigido, e onde

1. **Chamado só com confirmação explícita** (achado do `power-bi`). Regra em código: `isExplicitConfirmation` ([`domain/confirmation.ts`](../../src/domain/confirmation.ts)) e o `DraftService.confirm` recusa a confirmação pelo agent (`confirmation_required`) quando a mensagem do turno não é um "sim"/"pode criar" claro. O texto vem do turno (`TurnContext.employeeText`), não de argumento da tool. O botão Confirmar não muda. Na rodada 2 e na repetição, nenhum chamado nasceu num turno de mensagem ou clique que não confirmava (a checagem nova confere isso em todas as personas); na execução #3 do `power-bi-urgencia`, por exemplo, o "posso aguardar uns dias" com o rascunho na tela não criou nada, e o chamado só nasceu no "Sim, pode criar" seguinte.
2. **Problema novo não vai para o chamado errado** (achado do `vago-outlook`). `draftTicketUpdate` agora informa a categoria do problema do comentário, e `sameSubject` ([`domain/ticket.ts`](../../src/domain/ticket.ts)) recusa assunto diferente do chamado (`different_problem`), com a instrução de propor um chamado novo. Hardware e Software contam como o mesmo assunto. As instruções também pedem para não oferecer chamado existente antes de saber o problema. Na rodada 2, o INC-20311 não mudou em nenhuma das 6 conversas de Outlook, nem quando a persona respondia "acho que sim" à sugestão de um chamado antigo.
3. **Outlook é E-mail** (achado do `vago-outlook`). `categoryForTitle` corrige Software/Outros para E-mail quando o título fala de Outlook, webmail, caixa de entrada ou Exchange, e o trace registra a correção. A descrição da categoria na tool também diz isso. Nas 6 conversas de Outlook da rodada 2, a categoria saiu E-mail.
4. **Analista só quando o prazo não atende** (achado do `vpn-reuniao`; decisão de produto). `getTicket` e `draftNewTicket` recebem `neededBy`; `deadlineMeetsNeed` ([`domain/sla-need.ts`](../../src/domain/sla-need.ts)) compara. Prazo que não atende: o código põe o botão "Falar com um analista". Prazo que atende: o código tira o botão de analista das respostas rápidas do turno. A checagem do `vpn-reuniao` mudou junto (ver abaixo).

## O que ainda falhou

- **`outlook-direto` #2: prioridade baixa, esperada média.** O agent perguntou "como isso afeta suas atividades hoje?" com respostas rápidas, e o simulador clicou em "Sem urgência" sem contar que usa o webmail. Com "só eu" e "sem urgência", a matriz dá Baixa: o agent seguiu a regra com o que ouviu. A falha é de coleta (o agent não perguntou se havia alternativa) e de variação do simulador, não das quatro correções. A checagem continua exigindo Média, porque é o que a persona descreve.
- **Não medido:** o runner não registra, nas conversas que passaram, se o `vpn-reuniao` chegou a oferecer analista. A rodada 2 rodou depois das 15h, então a reunião já tinha passado e qualquer prazo "não atendia"; a checagem aceitava transferir ou não. O caso "prazo atende" foi medido no `prazo-atende` (3/3, sem oferta) e nos evals de prazo.

## Rodada 1 (28/10/2026, antes das correções)

## Método

Segue o τ-bench ([Yao et al., 2024](https://arxiv.org/abs/2406.12045)).

- Um modelo faz o papel do funcionário: Gemini 3.5 Flash Lite, temperatura 0,7 ([`evals/sim/run.ts`](../../evals/sim/run.ts)). Cada persona tem um objetivo e fatos que só conta se o agent perguntar ([`evals/sim/personas.ts`](../../evals/sim/personas.ts)). A cada vez, o simulador escreve uma mensagem, clica numa resposta rápida, confirma ou descarta o rascunho que está na tela, ou encerra.
- O agent é o de produção (Gemini 3.5 Flash), com as mesmas tools, regras e banco. A conversa tem no máximo 8 turnos.
- No fim, o runner confere o **estado no banco**, não o texto ([`evals/sim/checks.ts`](../../evals/sim/checks.ts)):
  - chamado novo com o tipo, a categoria e a prioridade esperados (ou nenhum chamado);
  - nenhum chamado criado sem o funcionário confirmar;
  - transferência para analista só quando a persona precisa;
  - limite de perguntas do agent;
  - nenhum dado de outra pessoa do seed na resposta.
- Toda execução parte do mesmo estado: o banco do `eval:sim` volta ao seed antes de cada uma ([`evals/sim/reset.ts`](../../evals/sim/reset.ts)).
- **pass^k** é a chance de acertar em todas as k tentativas da mesma tarefa, estimada sem viés como C(c, k) / C(n, k) ([`evals/sim/pass-k.ts`](../../evals/sim/pass-k.ts)). Com n = k = 3, pass^3 vale 1 quando as 3 execuções passaram e 0 nos outros casos.

### Resultado da rodada 1 (k = 3)

| Persona | O que ela testa | pass^1 | pass^3 | Turnos | Perguntas do agent | Custo/conversa |
|---|---|---|---|---|---|---|
| `vpn-reuniao` | VPN com erro 809 e reunião às 15h; espera INC de rede com prioridade alta, sem transferir, até 3 perguntas | 0,33 | 0,00 | 7,7 | 2,0 | US$ 0,109 |
| `horario` | só quer o horário do service desk; nenhum chamado | 1,00 | 1,00 | 2,0 | 1,0 | US$ 0,024 |
| `power-bi` | pede o Power BI Desktop; espera REQ de software com prioridade baixa ou média | 0,67 | 0,00 | 4,7 | 1,3 | US$ 0,063 |
| `vago-outlook` | começa com "nada funciona aqui!!"; o problema real é o Outlook; espera INC de e-mail com prioridade média | 0,33 | 0,00 | 7,7 | 2,0 | US$ 0,114 |
| `muda-de-ideia` | pede chamado e desiste quando o rascunho aparece; nenhum chamado | 1,00 | 1,00 | 4,0 | 1,7 | US$ 0,072 |
| `quer-pessoa` | quer um analista desde a primeira mensagem | 1,00 | 1,00 | 1,0 | 0,0 | US$ 0,015 |
| **Média** | | **0,72** | **0,50** | | | **US$ 1,19 no total** |

Nenhuma conversa vazou dado de outra pessoa.

### O que falhou na rodada 1, e por quê

1. **Chamado aberto sem confirmação** (`power-bi`, 1 de 3). Com o rascunho na tela, o simulador clicou numa resposta rápida sobre urgência ("Tenho alternativa / Posso aguardar"). O agent tratou isso como um "sim" e abriu o REQ. É a falha mais séria: a confirmação por texto só deveria valer quando a mensagem é claramente um "pode abrir". Próximo ajuste: aceitar confirmação só pelo botão ou por intenção explícita de confirmar, com um cenário de eval para esse caso.
2. **Problema novo anexado ao chamado errado** (`vago-outlook`, 1 de 3). O funcionário vago disse "tudo travado". O agent achou o chamado de lentidão do notebook (INC-20311) e ofereceu completá-lo, o simulador aceitou, e o "Outlook não abre" foi parar nesse chamado. O agent deveria ter notado que era outro problema e proposto um chamado novo.
3. **Categoria** (`vago-outlook`, 1 de 3). O Outlook foi classificado como "software", e o esperado era "e-mail". É uma ambiguidade real (o Outlook é um programa de e-mail), mas muda a fila de quem atende.
4. **Transferência depois do chamado aberto** (`vpn-reuniao`, 2 de 3). Nas duas execuções o agent abriu o chamado certo e depois o atualizou com o erro 809. Quando o funcionário perguntou pelo prazo, o agent ofereceu um analista, e o simulador aceitou. A checagem chama isso de "transferiu sem precisar". É discutível: com reunião às 15h e prazo para o dia seguinte, oferecer um humano faz sentido. Fica a decisão de produto: oferecer o analista só quando o prazo do chamado não atende a urgência informada. Na primeira execução, o agent também montou o rascunho antes de perguntar o código do erro.

## O que as rodadas ensinaram sobre o próprio teste

- **Confirmação por texto contava como "sem confirmar".** O harness só marcava "confirmou" quando o simulador clicava no botão. Na rodada 2, o `power-bi-urgencia` #3 reprovou com "chamado criado sem o funcionário confirmar", mas o chamado nasceu no turno de "Sim, pode criar", que a spec aceita. Era erro da checagem: agora um chamado criado no turno de uma mensagem com sinal claro de confirmação conta como confirmado, e um criado no turno de qualquer outra mensagem ou clique reprova com o texto do turno. A persona foi repetida com a checagem corrigida (3/3, US$ 0,29).
- **A checagem do `vpn-reuniao` mudou com a decisão de produto.** Antes ela exigia "nunca transferir". Agora transferir só reprova se o prazo do chamado novo atender a reunião das 15h (`handedOff: "only_if_sla_misses"`). A mudança segue a regra nova da spec, não o resultado.
- **Checagens novas:** chamado existente que não pode mudar (`untouched`) ou que precisa mudar (`updated`), oferta de analista (`noAnalystOffer`) e chamado criado no turno de um clique que não confirma.

- **O limite de mensagens contava como falha do provedor.** No `npm run eval` de 28/10, os "15 erros do provedor" eram o limite do próprio app (40 mensagens por hora por pessoa), porque todos os cenários usavam os mesmos funcionários no mesmo banco. O runner agora libera a janela de mensagens antes de cada cenário e só repete falhas do provedor. Erro de regra do app ou de banco para a rodada e mostra o motivo inteiro. Cada runner também tem o próprio banco. Com isso, a suíte completa deu **26/26**, com 1 turno respondido pelo modelo reserva.
- **As repetições herdavam o estado da anterior.** Na primeira rodada do `eval:sim`, o chamado que a execução #1 abria continuava no banco. Nas execuções #2 e #3, o agent o tratava, corretamente, como duplicado e o atualizava, e a checagem "1 chamado novo" reprovava. A média deu os mesmos 0,72 / 0,50, mas por motivos falsos. Depois do reset ao seed antes de cada execução, as falhas que sobraram são as quatro acima, todas do agent ou da checagem, nenhuma do estado.

## Limites

- k = 3 e 10 personas ainda são poucos: um acerto a mais ou a menos muda pass^1 em 0,03. A média serve para comparar versões do agent na mesma bateria, não como taxa de produção.
- O resultado depende da hora: o `vpn-reuniao` fala de uma reunião "hoje às 15h", e o prazo de 4 horas úteis só a atende de manhã.
- O simulador também é um modelo. Ele às vezes é mais vago do que a persona pede, como no "tudo travado" do `vago-outlook`, e isso faz parte da variação medida.
- O `eval:sim` não roda no CI, porque chama o modelo real e custa cerca de US$ 2,30 por rodada com 10 personas.

## Como repetir

```bash
npm run eval:sim                    # k = 3, todas as personas (cerca de 25 min e US$ 2,30)
npm run eval:sim -- --k=5 vpn       # só as personas com "vpn" no id, 5 vezes
npm run eval:sim -- --min=0.6       # sai com código 1 se o pass^k médio ficar abaixo de 0,6
```

Precisa de `GOOGLE_GENERATIVE_AI_API_KEY` no `.env`. O runner usa o próprio banco (`eval-sim.db`) e nunca toca no banco de desenvolvimento.
