# Métricas da busca · padrão ouro v1 (02/11/2026)

Este relatório aplica os critérios da seção 4 de [BASE-DE-CONHECIMENTO.md](../pesquisa/BASE-DE-CONHECIMENTO.md) à busca da central. Os conjuntos estão congelados em [`evals/retrieval/gold.ts`](../../evals/retrieval/gold.ts), e [`gold.test.ts`](../../evals/retrieval/gold.test.ts) falha se alguém editar uma pergunta ou repetir uma pergunta entre conjuntos.

> **Situação em 02/11:** a medição com LLM (híbrida + avaliador, 3 rodadas) não rodou. A chave do OpenRouter atingiu o limite de US$ 3 (`limit_remaining: 0`) antes deste dia, e o OpenRouter respondeu 403. A parte determinística (só palavras) foi medida hoje. A última medição com LLM é a de 30/10, reproduzida abaixo com os intervalos calculados agora.

## Os conjuntos

| Conjunto | Papel | Perguntas (sem artigo) | Impressão | Condição |
|---|---|---|---|---|
| calibracao | calibração | 33 (6) | `b651914761f1` | usado para escolher a margem em 28/10 |
| separado | validação | 17 (5) | `0f4e642ab971` | escrito depois da margem; erros vistos |
| diagnostico | validação | 13 (2) | `0224a332384a` | erros vistos |
| confusao | validação | 18 (6) | `d188581ce803` | congelado antes do avaliador; erros vistos no desenho dele |
| teste-final-v1 | validação | 40 (13), 7 estratos | `0c5c0421c5f8` | escrito em 02/11 antes de medir; rebaixado porque quem o escreveu ajustou o léxico depois |
| **teste-final-v2** | **teste final** | **214 (94)**, 7 estratos | `ebbfc1d3101e` | escrito **às cegas** por um subagente que não leu o código, o léxico nem as outras perguntas; 6 perguntas iguais a outros conjuntos foram removidas antes de congelar |

Os 4 conjuntos antigos deixaram de valer como teste final porque os erros deles foram olhados durante o desenvolvimento. O v1 também foi rebaixado: quem o escreveu (eu) depois escreveu o léxico de sinônimos, e uma palavra que eu soubesse estar no v1 poderia vazar para o léxico. O v2 resolve as duas coisas: autor cego e **214 perguntas**, acima das 190 necessárias para provar "artigo errado ≤ 2%" com zero erros.

## Precisão da busca por palavras (02/11)

A análise dos 25 erros dos conjuntos de calibração e validação (os do teste final não foram olhados) deu quatro causas de princípio, todas corrigidas em [`domain/knowledge.ts`](../../src/domain/knowledge.ts) com testes de artigos de brinquedo, não com as perguntas reais:

| Causa | Exemplo | Regra |
|---|---|---|
| Só o objeto bate | "notebook esquentando" → Pedir equipamento | objeto (notebook, monitor, teclado…) sozinho não escolhe artigo; precisa de sintoma, ou de sinal de pedido num artigo de pedido |
| Defeito × pedido | "o headset não pega minha voz" → Pedir equipamento | relato de defeito não vai para artigo de pedido |
| Evidência fraca | "levar o cachorro ao escritório" → Cabo ethernet | palavra fraca ("erro") ou uma palavra só no corpo não escolhe; o termo específico vem da tag ou do título |
| Vocabulário | "iPhone", "multifuncional", "e-mails", "impresora" | léxico curto de TI, uma letra errada em palavra longa, radical comum, tag de várias palavras pela frase inteira |

**No teste cego v2 (214 perguntas, medido uma vez):**

| Busca por palavras | Acerto [IC 95%] | Artigo errado [IC 95%] |
|---|---|---|
| Antes (HEAD `8622504`) | 58,9% [52,2–65,3] | 36,0% [29,9–42,6] |
| **Depois** | **67,8% [61,2–73,7]** | **22,9% [17,8–29,0]** |

McNemar pareado, depois × antes: **28 a 9, p = 0,0026**, uma melhora real. Por estrato (depois × antes): defeito 22 × 17 de 40, fora 25 × 20 de 38, coloquial 19 × 16 de 29, digitação 26 × 23 de 28, inglês 23 × 18 de 30, termo 14 × 14 de 19. **O estrato pedido piorou: 16 × 18 de 30.**

**O limite ficou claro:** na validação, a busca por palavras passa de 90%, mas no teste cego ela fica em 68%. Regras de palavras generalizam mal, e mais regras só aumentariam a distância. Os 95% vêm da busca por sentido com o avaliador (96,3% em 30/10), e a busca por palavras é o piso de quando os provedores caem.

## Primeira medição de 02/11: só palavras, antes das regras de precisão (determinística, sem custo)

É o modo em que a busca cai quando os provedores de embeddings estão fora do ar (`npm run eval:ouro -- --so-palavras`).

| Conjunto | Papel | n | Acerto [IC 95%] | Artigo errado [IC 95%] | Abstenção correta |
|---|---|---|---|---|---|
| calibracao | calibração | 33 | 78,8% [62,2%–89,3%] | 18,2% [8,6%–34,4%] | 4/6 |
| separado | validação | 17 | 82,4% [59,0%–93,8%] | 11,8% [3,3%–34,3%] | 3/5 |
| diagnostico | validação | 13 | 53,8% [29,1%–76,8%] | 46,2% [23,2%–70,9%] | 0/2 |
| confusao | validação | 18 | 50,0% [29,0%–71,0%] | 44,4% [24,6%–66,3%] | 0/6 |
| teste-final-v1 | teste final | 40 | 62,5% [47,0%–75,8%] | 25,0% [14,2%–40,2%] | 6/13 |
| **todos** | | **121** | **66,9% [58,2%–74,7%]** | | |

**Leitura:** só com palavras, uma em cada quatro perguntas do teste final recebe um artigo que não se aplica. Por isso a busca degradada tem alerta no Prometheus (`BuscaDegradada`, mais de 20% das buscas em 15 min) e aparece no console do analista com o motivo.

## Última medição com LLM (30/10, 81 perguntas dos 4 conjuntos antigos)

| Sistema | Acerto [IC 95%] | Artigo errado [IC 95%] |
|---|---|---|
| Só palavras | 69,1% (56/81) | 27,2% (22/81) |
| Híbrida (margem 0,02) | 82,7% [73,1%–89,4%] | 12,3% (10/81) |
| **Híbrida + avaliador** | **96,3% [89,7%–98,7%]** | **0,0% [0,0%–4,5%]** |
| Congelado `confusao`, com avaliador | 100% [82,4%–100%] (18/18) | 0 |

## Portões da seção 4.2

| Portão | Exigido | Situação | Veredito |
|---|---|---|---|
| Artigo errado | ≤ 2% no teste final | 0/81 em 30/10, mas o IC vai até 4,5%; teste final ainda não medido com LLM | **Não provado.** Com zero erros, são necessárias **pelo menos 190 perguntas** para o limite superior do IC ficar abaixo de 2% |
| Recall@5 da 1ª etapa | ≥ 0,95 | Em 30/10 o artigo certo nunca ficou fora dos 5 candidatos (81 perguntas) | Provável, falta reportar com IC pelo `eval:ouro` |
| Abstenção correta | ≥ 90% | Avaliador: 19/19 sem artigo em 30/10 (zero artigo errado implica abstenção em todas), IC [83,2%–100%] | Provável, falta o teste final |
| Latência p95 da busca | ≤ 2,5 s | +1,4 s do avaliador em 30/10; agora medida por busca (`nexo_retrieval_duration_seconds`) | Em observação (alerta `BuscaP95AcimaDoPortao`) |
| Repetições com LLM | ≥ 3 rodadas | Implementado no `eval:ouro` (pior rodada, perguntas instáveis) | Pendente: chave sem saldo |
| Comparação pareada | McNemar p < 0,05 | Implementado (exato, bicaudal) | Pendente para o teste final |

## Como medir de novo

```bash
npm run eval:ouro -- --so-palavras
```

```bash
npm run eval:ouro
```

O segundo comando usa a DeepInfra quando há `DEEPINFRA_API_KEY` (avaliador `RELEVANCE_JUDGE_MODEL=deepinfra/deepseek-ai/DeepSeek-V4-Flash`, ~US$ 0,06 por rodada nas 335 perguntas) e respeita o teto de `LLM_DAILY_BUDGET_USD`. Ele grava `evals/retrieval/results/<data>.json` e [METRICAS-BUSCA-OURO.md](METRICAS-BUSCA-OURO.md) com as tabelas por conjunto, o McNemar, o Recall@5, a latência e a quebra por estrato do teste final.
