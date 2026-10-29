# Roteamento em cascata: simulação com as conversas do benchmark

**Pergunta.** Dá para economizar sem perder qualidade se um modelo barato atender primeiro e o turno subir para um modelo maior só quando for arriscado? E o gatilho que decide a subida é confiável?

**Como respondi.** Com uma simulação offline sobre as 24 conversas por modelo que o [benchmark](RELATORIO.md) já tinha gravado. Não chamei API nenhuma (custo zero), e o resultado é o mesmo em toda execução.

## Resumo

- **A cascata funciona no que dá para medir aqui.** O GPT-6 Luna atendeu na frente e o Gemini 3.5 Flash Lite ficou de reserva. O acerto foi o mesmo do Flash Lite sozinho (96%), com 38% das conversas subindo e custo 37% menor (US$ 4,54 contra US$ 7,24 por 1.000 atendimentos).
- **A confiança que o modelo declara não serve de gatilho.** Em 23 dos 24 passos 0, o Luna declarou confiança de 0,95 ou mais. O único caso de risco que escapou tinha 0,98. Usando só a confiança, o gatilho não pega nenhum dos 9 casos de risco até o limite de 0,99, e nesse ponto já sobe um terço de tudo. Ele precisa olhar o que o agent vai fazer e ser conferido contra rótulo humano.
- **O gatilho precisa olhar cada turno.** Decidindo só pelo 1º turno, ele deixou passar 1 de 9 casos de risco: o de reabrir chamado, que no começo parece uma dúvida comum. Turno a turno, pegou 9 de 9.
- **O destino da subida também precisa de eval.** Subir para o Gemini 3.5 Flash, o modelo de produção, não melhorou nada: 83%, o mesmo do Flash sozinho e abaixo do Luna sozinho. Neste agent, "maior" não quer dizer "melhor".
- **A cascata com LLM piora a espera de quem sobe.** O turno que sobe paga dois passos 0, e o p95 foi de 9,7 s para 11,0 s. Na escala do PRD, a economia em dinheiro é pequena. Por isso o gatilho final deveria decidir sem chamar LLM.

## Como foi feito

- **Dados.** As conversas gravadas em `evals/benchmark/results/conversas/`: 10 cenários dos evals rodados 2 vezes e 4 cenários do PRD rodados 1 vez, total de 24 por modelo. São as mesmas conversas do relatório do benchmark, rodadas em 27/10 no `runAgentTurn` de produção.
- **Roteador.**
  - O modelo barato faz o passo 0, o `recordUnderstanding` com intenção e confiança.
  - O turno sobe se a intenção for `new_ticket`, `ticket_update`, `confirm_or_choose` ou `unclear`, ou se a confiança ficar abaixo de 0,5 (o mesmo `LOW_CONFIDENCE` do domínio).
  - Fica no barato quando é dúvida, consulta, fora do escopo, pedido de analista ou saudação.
  - A regra foi a que propus antes de ver estes números: rascunho de chamado, caso crítico e baixa confiança ficam no modelo maior.
- **Desfecho de quem sobe.** Uso a conversa do modelo maior para o mesmo cenário e a mesma repetição. O custo é o dela mais o passo 0 do barato, que já foi pago. A latência do 1º turno ganha a espera desse passo 0.
- **Rótulo humano.** Um cenário é "de risco" quando o que esperamos dele, escrito à mão em `evals/scenarios.ts` e `scenarios-prd.ts`, inclui uma ferramenta que escreve chamado (`draftNewTicket`, `draftTicketUpdate` ou `confirmDraft`). Foram 9 conversas de risco e 15 sem risco.
- **Contas.** São as mesmas do benchmark: custo real das chamadas, 3 turnos por atendimento e IC 95% por bootstrap. A conferência é que as linhas de um modelo só, na tabela abaixo, reproduzem os números do relatório.

## Resultado

| Rota | Acerto [IC 95%] | Subiu | Custo por 1.000 atendimentos | Latência p50 · p95 |
|---|---|---|---|---|
| GPT-6 Luna só | 88% [75%–100%] | 0% | US$ 1,22 | 5,7 s · 9,4 s |
| Gemini 3.5 Flash Lite só | 96% [88%–100%] | 0% | US$ 7,24 | 5,5 s · 9,7 s |
| Gemini 3.5 Flash (produção) só | 83% [67%–96%] | 0% | US$ 31,93 | 6,9 s · 11,1 s |
| **GPT-6 Luna → Gemini 3.5 Flash Lite** | **96%** [88%–100%] | 38% | **US$ 4,54** | 5,8 s · 11,0 s |
| GPT-6 Luna → Gemini 3.5 Flash (produção) | 83% [67%–96%] | 38% | US$ 16,93 | 6,4 s · 12,4 s |

Na projeção do benchmark, 10 mil funcionários fazem 4 mil atendimentos por mês. Nesse volume, a cascata custaria US$ 18 por mês, contra US$ 29 do Flash Lite sozinho e US$ 128 do Flash. A diferença para o Flash Lite, cerca de US$ 11 por mês, é menor que o custo de um único chamado de nível 1 humano (US$ 15,56, a referência do benchmark).

## O gatilho contra o rótulo humano

| Gatilho | Risco que subiu | Risco que ficou no barato | Sem risco que subiu | Sem risco no barato | Deixou passar |
|---|---|---|---|---|---|
| Só o 1º turno | 8 | 1 | 1 | 14 | PRD · Reabrir chamado resolvido há até 7 dias |
| Turno a turno | 9 | 0 | 1 | 14 | — |

- **O que escapou.** No reabrir, a 1ª mensagem ("A minha senha do SAP bloqueou de novo.") foi lida como `question` com confiança 0,98. O risco só aparece na 2ª ("Sim, é esse mesmo."), que o Luna registrou como `ticket_update` com 0,76. Um roteador por conversa não vê isso; um roteador por turno vê.
- **O falso positivo.** É a "mensagem vaga": `ticket_update` com 0,79. Subir custou dinheiro, não qualidade, e é um caso em que subir é defensável.

## A confiança declarada não ajuda

Variando a confiança mínima, com o modelo barato GPT-6 Luna e a reserva Gemini 3.5 Flash Lite:

| Gatilho | Confiança mínima | Risco que subiu | Acerto | Subiu | Custo por 1.000 |
|---|---|---|---|---|---|
| Intenção + confiança | 0,50 a 0,95 | 8/9 | 96% | 38% | US$ 4,54 |
| Intenção + confiança | 0,99 | 9/9 | 96% | 50% | US$ 5,57 |
| Só confiança | 0,50 | 0/9 | 88% | 0% | US$ 1,22 |
| Só confiança | 0,80 a 0,95 | 0/9 | 88% | 4% | US$ 1,42 |
| Só confiança | 0,99 | 5/9 | 92% | 33% | US$ 4,07 |

Quem separa o que é arriscado é a intenção, ou seja, o que o agent vai fazer. A nota que o modelo dá para si mesmo é quase sempre alta, até quando ele erra. A literatura descreve o mesmo excesso de confiança quando o modelo diz a própria confiança em texto ([arXiv 2306.13063](https://arxiv.org/abs/2306.13063)), e por isso o gatilho precisa ser calibrado com rótulo humano, não com a confiança declarada pelo próprio modelo.

## Limites

- **Amostra pequena.** São 24 conversas de 14 cenários. Os intervalos se sobrepõem: os 8 pontos a mais da cascata sobre o Luna sozinho não são distinguíveis com essa amostra. O teste mostra que a ideia se sustenta, não que ela já ganhou.
- **Simulação por conversa, não por turno.** Quando sobe, uso a conversa inteira do modelo maior, gravada à parte, e não uma conversa que começou no barato e trocou de modelo no meio. A linha "turno a turno" mede só o gatilho, não o desfecho.
- **Dados de antes das correções.** As conversas são de 27/10. O reabrir e o caso crítico foram corrigidos no prompt depois (`f7bd083` e `f0d0232`). O caso que escapou do gatilho hoje é tratado melhor pelo próprio agent.
- **Sem sinal próprio para caso crítico.** Ele subiu só porque a intenção era `new_ticket`. Um roteador de verdade precisa de um sinal de impacto.
- **Rótulo humano limitado.** É o que os cenários escritos à mão esperam, não a marcação de analistas reais.
- **Fora do teste.** Não medi o caminho sem LLM: responder direto com a central ou com regra fixa, como o status de um chamado com número. Também não refiz o G-Eval das rotas; aqui entram efetividade, custo e latência.

## O que falta para ir a produção

1. **Roteador turno a turno.** Depois que a conversa sobe, ela fica no modelo maior, para não trocar de modelo no meio de um rascunho. Caso crítico e pedido de analista podem ir direto para a fila.
2. **Rótulo humano de verdade.** A marcação do analista no console ("o agent acertou?") e as conversas transferidas viram a base para calibrar o gatilho. Gente revisa antes de mudar a regra.
3. **Gatilho sem LLM.** Com rótulos suficientes, um classificador leve sobre os embeddings que a busca já calcula decide antes de chamar qualquer modelo. Isso tira a espera dobrada de quem sobe, e as dúvidas que a central responde com folga saem sem LLM.
4. **Modo sombra.** O roteador decide em produção, mas não age. A decisão dele é comparada com o que aconteceu.
5. **Critério para ligar.** A rota só entra se os evals, o funcionário simulado (pass^k) e o G-Eval de cada rota não caírem.

Referências: FrugalGPT, cascata de modelos por custo ([arXiv 2305.05176](https://arxiv.org/abs/2305.05176)); RouteLLM, roteador treinado com preferência humana ([arXiv 2406.18665](https://arxiv.org/abs/2406.18665)).

## Como reproduzir

```bash
npm run benchmark:roteamento
```

- Não precisa de chave e não custa nada.
- Imprime as tabelas acima e grava `docs/benchmark/roteamento.json`.
- O código está em `evals/benchmark/routing.ts` e os testes em `routing.test.ts`.
