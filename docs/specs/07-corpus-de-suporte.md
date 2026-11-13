# 07 · Corpus externo de suporte e grafo

O laboratório importa artigos públicos oficiais da Microsoft a partir de uma seleção revisada, fixada por commit e SHA-256. Cada documento mantém texto integral, idioma, público, produtos, URL original e licença. A importação falha integralmente se conteúdo, tamanho ou origem divergir; o snapshot anterior permanece disponível.

A busca local compara BM25 com BM25 mais expansão de um salto por hyperlinks explícitos entre artigos importados. O grafo também representa produtos, mas produto em comum não prova que um procedimento resolve outro incidente. Cada resultado expõe a origem e o caminho que justificou sua inclusão. Sem correspondência lexical não há expansão.

O laboratório não usa LLM, embeddings, tradução, banco da aplicação ou credenciais. Artigos externos são dados não confiáveis; seus procedimentos não são executados. O chat continua usando sua base atual até revisão de público, adaptação ao português e avaliação independente.

Critérios de aceite: download íntegro → snapshot reproduzível com atribuição; hash incorreto → erro sem substituir snapshot; hyperlink relativo entre dois artigos → aresta com evidência; menção ao mesmo produto → apenas vínculo de produto; busca sem termos presentes → nenhum resultado. Avaliação offline registra hash do corpus e dos casos, Recall@k, MRR@k, Precision@k e abstinência em perguntas sem resposta, lado a lado com a busca sem grafo, pelo mesmo k.

## Contrato e implantação

- Domínio: documentos, grafo, ranking e métricas em `src/domain/support-corpus.ts`.
- Infraestrutura: seleção validada e downloads limitados em `src/infrastructure/support-corpus.ts`.
- Entrada: manifesto versionado em `datasets/microsoft-support.json`; saída local ignorada pelo Git em `.support-corpus/`.
- Estado: manifesto validado → todos os downloads e hashes validados → snapshot temporário → substituição atômica. Falha antes da substituição não publica corpus parcial.
- Rollback: apagar ou trocar o snapshot local; nenhum efeito sobre a aplicação publicada. Atualização de fonte exige novo commit/hash e revisão do manifesto.
- Medição de eficácia: casos de desenvolvimento servem para depuração. Só casos reservados, revisados por pessoa com experiência de suporte e sem ajuste posterior do ranking sustentam comparação de qualidade. O piloto pequeno não prova resolução de chamados reais.
