# Custos e economia do Nexo Assist

Quanto custa cada atendimento, o que cada decisão de projeto economizou e como isso se compara ao custo de um chamado atendido por pessoa. Os números medidos vêm da gravação de 02/11/2026 (build de produção local, `deepinfra/deepseek-ai/DeepSeek-V4-Flash`, tokens gravados no trace de cada turno). As comparações de mercado vêm de fontes externas, citadas no fim, e os cenários de economia são hipóteses marcadas como tal.

## Preços em uso (DeepInfra, 02/11/2026)

| Uso | Modelo | Preço por milhão de tokens |
|---|---|---|
| Agente | DeepSeek-V4-Flash | US$ 0,09 de entrada · US$ 0,18 de saída (entrada em cache: 20% do preço) |
| Avaliador de relevância | DeepSeek-V4-Flash | o mesmo |
| Embeddings da busca | Qwen3-Embedding-8B | US$ 0,01 de entrada |
| Leitura de imagem | Mistral-Small-3.1-24B | US$ 0,05 de entrada · US$ 0,10 de saída; medido em cerca de US$ 0,0001 por imagem (a imagem conta tokens próprios) |
| Juiz da G-Eval (só nos evals) | GLM-5.3-Flash | US$ 0,15 de entrada · US$ 0,50 de saída |

## Custo medido por atendimento

Tokens somados dos traces da conversa gravada:

| Atendimento | Turnos do agente | Tokens (entrada · saída) | Custo do agente | Com a imagem | Custo total estimado |
|---|---|---|---|---|---|
| Monitor apagado com foto, resolvido sem analista | 3 | 49.484 · 909 | US$ 0,0046 | + US$ 0,0001 | **cerca de US$ 0,005** |
| Erro no ponto, virou chamado (incidente em massa) | 6 | 78.692 · 1.721 | US$ 0,0074 | — | **cerca de US$ 0,0075** |
| Pedido de analista (transferência) | 1 | 14.131 · 398 | US$ 0,0013 | — | **cerca de US$ 0,0013** |

O livro-caixa da gravação somou **US$ 0,0135** para 10 turnos do agente e uma leitura de imagem, o mesmo valor que sai dos tokens (US$ 0,0134 do agente e US$ 0,0001 da imagem).

**O que o livro-caixa ainda não registra:** a sugestão de resposta do analista, os embeddings da pergunta e o avaliador de relevância. Pelos tamanhos dos pedidos, somam menos de US$ 0,001 por conversa, mas ficam fora do teto. Corrigir isso é a primeira melhoria de custo da lista abaixo.

Em mil atendimentos do tipo "resolvido sem analista", o gasto com modelo fica perto de **US$ 5**; em mil que viram chamado, perto de **US$ 7,50**.

## O que cada decisão economizou

### Troca de modelo, medindo antes

Com os mesmos tokens do atendimento do monitor:

| Modelo | Preço (entrada · saída) | Custo do atendimento | Em relação ao atual |
|---|---|---|---|
| Gemini 3.5 Flash (produção até 29/10) | US$ 1,50 · US$ 9,00 | US$ 0,082 | 18 vezes mais caro |
| GPT-6 Luna pelo OpenRouter (30/10 a 02/11) | US$ 0,10 · US$ 0,50 | US$ 0,0054 | 1,2 vez |
| **DeepSeek-V4-Flash pela DeepInfra (desde 02/11)** | **US$ 0,09 · US$ 0,18** | **US$ 0,0046** | — |

A troca para o DeepSeek só foi feita depois de a suíte de evals passar inteira com ele (36 de 36, por US$ 0,07). O benchmark de modelos anterior está em [`benchmark/RELATORIO.md`](benchmark/RELATORIO.md).

### Regras em código, não no prompt

Prioridade, prazo, duplicidade, confirmação, incidente em massa e o relatório do analista são calculados em código. Nenhum desses passos gasta token, e o relatório da conversa sai do histórico e dos traces sem chamar o modelo.

### Imagem descrita uma vez

A imagem vai para um modelo de visão barato uma única vez, e o agente recebe só a descrição em texto. Se a imagem fosse direto para o modelo do agente, os tokens dela voltariam em todo turno seguinte, porque o histórico é reenviado a cada turno. Com a descrição gravada, o custo da imagem é fixo (cerca de US$ 0,0001) em vez de crescer com a conversa, e o analista reaproveita a mesma descrição sem nova chamada.

### Limites que seguram o custo

- Histórico de no máximo 20 mensagens, cada uma cortada em 1.500 caracteres; cards viram notas curtas.
- Até 6 passos e 800 tokens de saída por passo; temperatura 0,2.
- Teto de gasto em dólares por dia e no total, conferido **antes** de cada chamada (429 ao bater); na demo pública, US$ 0,07 por dia e US$ 1,50 no total.
- Limites por pessoa (30 mensagens por sessão, 40 por hora, 120 por dia) e teto global de turnos.

## Comparação com o atendimento por pessoa

A referência de mercado mais citada para o custo de um chamado de nível 1 é a da MetricNet, publicada pela HDI: **US$ 15,56 em média** por chamado de service desk na América do Norte (faixa de US$ 2,93 a US$ 49,69, dados de 2016), e **US$ 2,37** por chamado resolvido em autoatendimento (2021). São dados antigos e de outro mercado; para uma operação brasileira, o certo é calcular com o custo mensal da equipe dividido pelo volume de chamados do mesmo mês.

Mesmo com essa ressalva, a ordem de grandeza é clara: um atendimento resolvido pelo agente custa cerca de **US$ 0,005** em modelo, contra dólares por chamado atendido por pessoa. O custo de operação do sistema (hospedagem, banco, manutenção) não entra nessa conta e precisa ser somado numa análise de verdade.

### Cenário ilustrativo (hipótese)

Uma empresa de 1.000 funcionários com 1.000 contatos por mês no service desk. Se o agente resolver sozinho uma parte deles, o custo evitado com a referência de US$ 15,56 por chamado seria:

| Resolvidos sem analista | Chamados evitados por mês | Custo evitado (referência MetricNet) | Gasto com modelo (todos os 1.000 contatos) |
|---|---|---|---|
| 10% | 100 | US$ 1.556 | cerca de US$ 7 |
| 20% | 200 | US$ 3.112 | cerca de US$ 7 |
| 30% | 300 | US$ 4.668 | cerca de US$ 7 |

A taxa de resolução sem analista ainda não foi medida com usuários reais; os Indicadores do console calculam a "resolução honesta" (confirmada separada da presumida) justamente para essa conta ser feita com dados da operação, não com a hipótese.

## Orçamento da demo

- Crédito pré-pago de US$ 3 na DeepInfra, sem recarga automática: é o teto duro.
- Na produção (Vercel), US$ 0,07 por dia e US$ 1,50 no total para a demo pública; o resto fica para os evals, com o mesmo teto diário no livro-caixa local.
- Medições e gravações locais também gastam esse crédito. As quatro tomadas do vídeo de 02/11 custaram cerca de US$ 0,06 no total; como o banco da gravação é recriado a cada tomada, esse gasto não fica no livro-caixa e precisa ser conferido no painel da DeepInfra.

## Próximas economias, em ordem

1. **Registrar tudo no livro-caixa:** sugestão de resposta, embeddings e avaliador passam a contar no teto.
2. **Cache de prompt:** com a parte fixa do prompt primeiro, a entrada repetida é cobrada a 20% do preço. Como a entrada é mais de 95% do custo de um turno, a economia esperada fica perto de 60% do gasto do agente; medir antes e depois com a mesma conversa.
3. **Roteamento em cascata:** perguntas simples (saudação, horário, status de chamado) para um modelo menor; a simulação já existe nos evals.
4. **Menos perguntas por chamado:** na gravação, o chamado do ponto levou 6 turnos; as perguntas que não mudam a prioridade podem sair, o que corta tempo e custo juntos.

## Fontes

- Preços: API pública de modelos da DeepInfra, consultada em 02/11/2026; tabela em [`src/agent/model-config.ts`](../src/agent/model-config.ts).
- Tokens por turno: traces da gravação de 02/11/2026 (`TurnTrace.usage`).
- MetricNet via HDI: [Metric of the Month: Cost per Ticket (HDI)](https://www.thinkhdi.com/~/media/HDICorp/Files/Library-Archive/Insider%20Articles/Cost%20per%20Ticket.pdf) e o resumo em [eesel.ai: benchmarks de custo por ticket](https://www.eesel.ai/pt/blog/custo-por-ticket-benchmarks).
