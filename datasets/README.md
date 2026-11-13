# Laboratório de suporte Microsoft

Primeira integração: cinco artigos oficiais de Microsoft Teams, Outlook e Windows Update. O manifesto fixa a revisão `53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4` de [MicrosoftDocs/SupportArticles-docs](https://github.com/MicrosoftDocs/SupportArticles-docs). Cada arquivo é verificado por SHA-256 antes de publicar o snapshot local. O download completo tem cerca de 30 KB.

```sh
npm run support:import
npm run support:query -- "Teams error 0xCAA70007"
```

O primeiro comando baixa os textos e grava `.support-corpus/microsoft.json`, incluindo o grafo e a atribuição. O segundo mostra lado a lado BM25 e BM25 com expansão por referências. `via` identifica o artigo que trouxe um resultado pelo grafo; o snapshot contém a evidência exata do hyperlink. Os comandos não carregam `.env`, não consultam modelos, não criam embeddings e não escrevem no banco do chat. Reimportar a seleção produz o mesmo hash de corpus; apenas a data da coleta muda. Falha de download/hash preserva o snapshot anterior.

## O que está pronto e o que ainda é experimento

A seleção tem **5 documentos, 6 nós de produto, 7 vínculos de produto e 1 referência entre artigos**. A relação liga o diagnóstico de erros de login do Teams ao artigo sobre loop de autenticação. Produtos em comum não são usados para expandir a busca. Isso é recuperação auxiliada por um grafo de relações explícitas; não é o pipeline completo de extração e resumo por comunidades do Microsoft GraphRAG.

Os textos estão em inglês e são voltados a profissionais de TI. A busca não traduz perguntas em português. Avisos, requisitos de administrador e blocos de código permanecem no Markdown original; o laboratório não os executa nem renderiza HTML externo. Metadados de título/produto foram normalizados manualmente na seleção. O conteúdo é da Microsoft, sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), conforme [licença do repositório na revisão usada](https://github.com/MicrosoftDocs/SupportArticles-docs/blob/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/LICENSE). Os links canônicos foram conferidos individualmente: o caminho no repositório não corresponde sempre à URL publicada.

O chat publicado ainda consulta a sua base anterior. Conectar estes documentos ao atendimento requer curadoria dos procedimentos permitidos para funcionários, adaptação linguística e avaliação reservada. Não há integração com tickets privados de Microsoft, Zendesk ou ServiceNow.

## Comparação reproduzível

Crie um JSON de casos revisados por um profissional de suporte. Use o `corpusSha256` exibido na importação. `relevantIds` contém todos os documentos necessários; use `[]` para perguntas sem resposta no corpus.

```json
{
  "purpose": "holdout",
  "reviewer": "nome do revisor e data",
  "corpusSha256": "hash retornado pela importação",
  "k": 3,
  "cases": [
    { "id": "ticket-anonimizado-001", "query": "pergunta revisada", "relevantIds": ["id-do-artigo"] }
  ]
}
```

```sh
npm run support:eval -- caminho/casos.json
```

O relatório salva os hashes do corpus e dos casos, rankings por pergunta, Recall@k, MRR@k, Precision@k e acerto de abstinência. Recall/MRR/Precision são médias apenas dos casos respondíveis; abstinência é separada. Precision@k usa k como denominador, inclusive quando retorna menos resultados. Métrica sem casos aplicáveis retorna `null`, nunca 100% fictício. O mesmo k e corpus são usados nas duas variantes.

Para provar eficácia real: reservar tickets anonimizados por família de incidente, antes de ajustar a busca; dois revisores avaliam evidências e procedimentos; comparar busca sem grafo e com grafo de forma cega; só depois fazer piloto supervisionado e medir resolução confirmada, tempo até solução, reabertura e intervenções incorretas. Ganho de Recall em cinco artigos não prova resolução nem impacto comercial. O relatório de pesquisa detalha o desenho e fontes: [dados de suporte e grafo](../docs/pesquisa/DADOS-SUPORTE-E-GRAFO-2026-11-13.md).
