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
| **teste-final-v1** | **teste final** | 40 (13), 7 estratos | `0c5c0421c5f8` | escrito em 02/11, antes de qualquer medição; os erros dele não são mostrados nem usados para ajustar nada |

Os 4 conjuntos antigos deixaram de valer como teste final porque os erros deles foram olhados durante o desenvolvimento. O `teste-final-v1` cobre defeito com artigo, pedido, fora da central, termo exato, coloquial, erro de digitação e mistura com inglês.

## Medido hoje: só palavras (determinístico, sem custo)

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

O segundo comando precisa de saldo no OpenRouter (~US$ 0,10 com 3 rodadas). Ele grava `evals/retrieval/results/<data>.json` e reescreve este arquivo com as tabelas por conjunto, o McNemar, o Recall@5, a latência e a quebra por estrato do teste final.
