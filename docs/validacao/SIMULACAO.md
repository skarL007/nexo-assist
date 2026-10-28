# Funcionário simulado (pass^k)

**Pergunta:** o agent leva a conversa ao estado certo de forma consistente, quando quem conversa é uma pessoa que não conta tudo de uma vez, muda de ideia ou só quer um humano?

**Resposta:** nem sempre. Na rodada de 28/10/2026, com 6 personas × 3 execuções, o agent acertou **13 de 18 conversas (pass^1 = 0,72)**. Só **3 das 6 personas acertaram nas 3 execuções (pass^3 = 0,50)**. As falhas apontam 3 comportamentos do agent para corrigir, descritos abaixo. A rodada custou **US$ 1,19** (18 conversas) e levou 15 minutos.

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

## Resultado (28/10/2026, k = 3)

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

## O que falhou, e por quê

1. **Chamado aberto sem confirmação** (`power-bi`, 1 de 3). Com o rascunho na tela, o simulador clicou numa resposta rápida sobre urgência ("Tenho alternativa / Posso aguardar"). O agent tratou isso como um "sim" e abriu o REQ. É a falha mais séria: a confirmação por texto só deveria valer quando a mensagem é claramente um "pode abrir". Próximo ajuste: aceitar confirmação só pelo botão ou por intenção explícita de confirmar, com um cenário de eval para esse caso.
2. **Problema novo anexado ao chamado errado** (`vago-outlook`, 1 de 3). O funcionário vago disse "tudo travado". O agent achou o chamado de lentidão do notebook (INC-20311) e ofereceu completá-lo, o simulador aceitou, e o "Outlook não abre" foi parar nesse chamado. O agent deveria ter notado que era outro problema e proposto um chamado novo.
3. **Categoria** (`vago-outlook`, 1 de 3). O Outlook foi classificado como "software", e o esperado era "e-mail". É uma ambiguidade real (o Outlook é um programa de e-mail), mas muda a fila de quem atende.
4. **Transferência depois do chamado aberto** (`vpn-reuniao`, 2 de 3). Nas duas execuções o agent abriu o chamado certo e depois o atualizou com o erro 809. Quando o funcionário perguntou pelo prazo, o agent ofereceu um analista, e o simulador aceitou. A checagem chama isso de "transferiu sem precisar". É discutível: com reunião às 15h e prazo para o dia seguinte, oferecer um humano faz sentido. Fica a decisão de produto: oferecer o analista só quando o prazo do chamado não atende a urgência informada. Na primeira execução, o agent também montou o rascunho antes de perguntar o código do erro.

## O que a rodada ensinou sobre o próprio teste

- **O limite de mensagens contava como falha do provedor.** No `npm run eval` de 28/10, os "15 erros do provedor" eram o limite do próprio app (40 mensagens por hora por pessoa), porque todos os cenários usavam os mesmos funcionários no mesmo banco. O runner agora libera a janela de mensagens antes de cada cenário e só repete falhas do provedor. Erro de regra do app ou de banco para a rodada e mostra o motivo inteiro. Cada runner também tem o próprio banco. Com isso, a suíte completa deu **26/26**, com 1 turno respondido pelo modelo reserva.
- **As repetições herdavam o estado da anterior.** Na primeira rodada do `eval:sim`, o chamado que a execução #1 abria continuava no banco. Nas execuções #2 e #3, o agent o tratava, corretamente, como duplicado e o atualizava, e a checagem "1 chamado novo" reprovava. A média deu os mesmos 0,72 / 0,50, mas por motivos falsos. Depois do reset ao seed antes de cada execução, as falhas que sobraram são as quatro acima, todas do agent ou da checagem, nenhuma do estado.

## Limites

- k = 3 e 6 personas são poucos: um acerto a mais ou a menos muda pass^1 em 0,06. A média serve para comparar versões do agent na mesma bateria, não como taxa de produção.
- O simulador também é um modelo. Ele às vezes é mais vago do que a persona pede, como no "tudo travado" do `vago-outlook`, e isso faz parte da variação medida.
- O `eval:sim` não roda no CI, porque chama o modelo real e custa cerca de US$ 1,20 por rodada.

## Como repetir

```bash
npm run eval:sim                    # k = 3, todas as personas (cerca de 15 min e US$ 1,20)
npm run eval:sim -- --k=5 vpn       # só as personas com "vpn" no id, 5 vezes
npm run eval:sim -- --min=0.6       # sai com código 1 se o pass^k médio ficar abaixo de 0,6
```

Precisa de `GOOGLE_GENERATIVE_AI_API_KEY` no `.env`. O runner usa o próprio banco (`eval-sim.db`) e nunca toca no banco de desenvolvimento.
