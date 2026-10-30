# Pesquisa: como decidir se um artigo da central se aplica (30/10/2026)

Pesquisa feita em 30/10/2026, com todas as URLs acessadas nessa data. Ela respondeu a uma pergunta que a medição levantou: a busca por sentido acha artigos do **mesmo assunto**, mas não sabe se o artigo **se aplica**. Dois exemplos:

- "Vou trabalhar de casa e queria um teclado sem fio" é um pedido, mas caía no artigo de conserto "Teclado ou mouse parou de responder".
- "Ventilador fazendo barulho" recebia "Computador não liga".

Num conjunto de 18 perguntas escrito antes de qualquer correção (6 pedidos, 6 defeitos com artigo e 6 sintomas que nenhum artigo cobre), a busca acertou 9 de 18.

> **O que virou código:** o avaliador de relevância em duas etapas (seção 1, padrão CRAG, com as três respostas). Os números estão em [BUSCA.md](../validacao/BUSCA.md#avaliador-de-relevância-30102026) e o comportamento na [spec](../specs/02-agent.md#avaliador-de-relevância).

## 1. Decidir se o documento se aplica

| Projeto ou paper | Como faz | Evidência | Serve aqui? |
|---|---|---|---|
| [CRAG](https://arxiv.org/abs/2401.15884) | Um avaliador classifica o que a busca trouxe em correto, incorreto ou ambíguo, e cada classe gera uma ação | Avaliador T5 treinado com 84,3% contra 58,0% do ChatGPT zero-shot (PopQA) | **Sim, a ideia das três ações.** O "ambíguo" vira pergunta de esclarecimento. Treinar o avaliador não cabe com 81 perguntas: aqui é um LLM com critério escrito |
| [Onyx (ex-Danswer)](https://github.com/onyx-dot-app/onyx/blob/main/backend/onyx/secondary_llm_flows/document_filter.py) | Um LLM dá nota de 0 a 3 a cada trecho. A nota 0 inclui "parece do assunto, mas é outro contexto" | Sem números publicados | Sim, o critério. A política dele é falhar aberto (mantém o documento em erro); aqui a falha volta para a regra de margem |
| [LlamaIndex `LLMRerank`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/postprocessor/llm_rerank.py) | Avalia a lista inteira numa chamada (listwise), dá nota de 1 a 10, omite os irrelevantes e pode devolver vazio | — | Sim, o formato. O `SimilarityPostprocessor` é só um corte de score, o mesmo problema que já tínhamos |
| [Haystack `LLMRanker`](https://github.com/deepset-ai/haystack/blob/main/haystack/components/rankers/llm_ranker.py) | Listwise com JSON schema; lista vazia é resposta válida (abstenção) | — | Sim |
| [CRAG e Adaptive RAG no LangGraph](https://github.com/langchain-ai/langgraph/blob/main/examples/rag/langgraph_crag.ipynb) | Avaliador de sim ou não | — | Só a estrutura. O critério deles é frouxo de propósito ("keyword or semantic meaning related"), e "ventilador" passaria para "não liga" |
| [Self-RAG](https://arxiv.org/abs/2310.11511) | Token de relevância aprendido no fine-tuning | Exige treinar um Llama 2 de 7B ou 13B | Não |
| [Sufficient Context (Google)](https://arxiv.org/abs/2411.06037) | Um autorater decide se o contexto basta para responder | Acurácia de 0,93 com um exemplo no prompt; a abstenção seletiva sobe de 2 a 10 pontos a fração de respostas corretas entre as respondidas | Reforça: o critério escrito no prompt pesa no resultado |
| [Dify](https://github.com/langgenius/dify/blob/main/api/core/rag/datasource/retrieval_service.py) | Na busca híbrida, desliga o limiar do embedding porque esse score "não é comparável" ao fundido | — | Confirma que cortar pelo cosseno é frágil |
| [Rasa Enterprise Search](https://rasa.com/docs/reference/config/policies/enterprise-search-policy) | `check_relevancy`, desligado por padrão: o LLM responde `[NO_RAG_ANSWER]` quando não tem 80% de confiança | — | A mesma ideia de abstenção |

## 2. Rerankers e limiares

Medimos três rerankers do OpenRouter nas 63 perguntas antigas: voyage rerank-2.5, voyage rerank-2.5-lite e qwen3-reranker-8b.

- **Sozinhos:** de 46 a 57 acertos em 63.
- **Combinados com a híbrida:** só um limiar exato dava ganho (59/63 com 0,36, 57/63 com 0,40).
- **Cohere rerank-4:** custa US$ 0,002 por busca, cerca de US$ 4 no teto da demo.

A literatura explica o resultado:
- O score de reranker ordena, não mede relevância absoluta, e não vale entre modelos ([Redis, 2026](https://redis.io/blog/top-reranking-models-rag-accuracy/)).
- Calibrar um limiar com garantia pede ordens de grandeza mais exemplos do que temos ([predição conformal](https://arxiv.org/abs/2107.07511)).
- Com 18 perguntas, o intervalo de Wilson de 9/18 vai de 29% a 71%.

Decisão categórica (aplica, talvez ou nenhum) é mais robusta que limiar.

## 3. Roteamento por intenção e estrutura da base

- **[semantic-router](https://github.com/aurelio-labs/semantic-router) e [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails/blob/develop/nemoguardrails/rails/llm/config.py)**
  - Rotas por frases de exemplo, com limiar.
  - O NeMo usa o LLM em cascata quando a similaridade fica baixa.
  - Exigiria escrever exemplos de pedido e defeito fora dos conjuntos de teste. O avaliador já resolveu os pedidos (6 de 6), então ficou como opção.
- **[KCS v6](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/030/020/010)**
  - O artigo separa o Issue (a situação nas palavras de quem relata) da Resolution.
  - Tirar o texto das verificações (a resolução) do embedding ajudou pouco: 11 de 18 no conjunto congelado, contra 9, e piorou o diagnóstico. Ficou como está.
- **[Contextual Retrieval (Anthropic)](https://www.anthropic.com/news/contextual-retrieval)**
  - Abaixo de 200 mil tokens, a base inteira cabe no prompt.
  - Testamos o juiz com o catálogo inteiro, em paralelo com a busca: 78/81, mas 16 de 18 no conjunto congelado e o dobro do custo. Ficou o top-5, que escala se a central crescer.
- **[HyDE](https://arxiv.org/abs/2212.10496):** põe outra chamada de LLM em série antes da busca e não decide se o artigo se aplica. Descartado.

## 4. Comparação medida (81 perguntas: 33 de calibração, 17 do conjunto separado, 13 de equipamento e 18 congeladas)

| Abordagem | Total | Congelado | US$ por busca | Latência a mais |
|---|---|---|---|---|
| Só palavras-chave | 56/81 | 9/18 | 0 | — |
| Híbrida com margem (antes) | 67/81 | 9/18 | 0,0000014 | — |
| Sem as verificações no embedding | 69/81 | 11/18 | igual | — |
| Avaliador nos 5 candidatos, sim ou não, Flash Lite | 77/81 | 18/18 | 0,000225 | +1,4 s |
| **Avaliador nos 5 candidatos, aplica/talvez/nenhum, Flash Lite** | **78–79/81** (4 rodadas) | **18/18** | **0,00025** | **+1,4 s** |
| Avaliador nos 5 candidatos, aplica/talvez/nenhum, GPT-6 Luna | 79/81 | 18/18 | 0,00009 | +1,9 s (p90 3,2 s) |
| Juiz com o catálogo inteiro, Flash Lite | 78/81 | 16/18 | 0,00047 | ~0 (em paralelo) |
| Juiz com o catálogo inteiro, GPT-6 Luna | 78/81 | 17/18 | 0,00006 | +2,4 s |

O que ficou fora dos acertos são abstenções nas perguntas de VPN sem o código "809". O artigo se chama "VPN com erro 809" e vale só para Windows 10, então recusá-lo para "a VPN não conecta quando estou viajando" é cautela defensável. Em nenhuma das rodadas com o avaliador escolhido apareceu artigo errado.
