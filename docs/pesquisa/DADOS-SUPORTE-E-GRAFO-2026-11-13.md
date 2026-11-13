# Farol Desk: dados de suporte, recuperação com grafo e prova de eficácia

Data da verificação: 13/11/2026. Esta pesquisa atualiza `BASE-DE-CONHECIMENTO.md`, de 02/11/2026. Foram consultados os mantenedores, os arquivos publicados, as APIs oficiais e a documentação original. Nenhuma chamada paga de modelo, geração de embedding ou escrita em banco de produção foi executada. O teto de US$ 0,07 permanece inalterado.

## Decisão recomendada

Integrar primeiro **documentação real de suporte de TI da Microsoft**, com versão fixa, origem e licença por artigo. O usuário confirmou o foco em Microsoft 365/Windows durante esta pesquisa. Preparar a recuperação local e um grafo pequeno, formado por produtos e links explícitos entre artigos. Comparar esse grafo com uma busca lexical sem grafo antes de adotá-lo no atendimento.

Usar **WixQA como benchmark externo de recuperação** e o dataset **synthetic-it-support-tickets como material sintético de desenvolvimento**. São funções diferentes: documentação aplicável ao produto, prova externa do mecanismo de busca e simulação de incidentes. Nenhuma dessas fontes, sozinha, demonstra que o Farol resolveu chamados reais de uma organização.

Não há evidência nesta pesquisa de que instalar Microsoft GraphRAG melhoraria o Farol. O experimento de menor custo é recuperar documentos e expandir relações explícitas, sem extrair entidades com LLM. O Microsoft GraphRAG padrão usa modelos em diversas etapas; inclusive FastGraphRAG ainda usa LLM para relatórios de comunidades. Portanto, FastGraphRAG não significa execução integral sem modelo. [Fluxo oficial](https://microsoft.github.io/graphrag/index/default_dataflow/), [métodos oficiais](https://microsoft.github.io/graphrag/index/methods/).

## 1. Fontes revalidadas

| Fonte | Quantidade verificada | Licença publicada | Papel no Farol |
|---|---:|---|---|
| MicrosoftDocs/SupportArticles-docs | 7.940 caminhos terminados em `.md` na árvore consultada; inclui arquivos auxiliares, não equivale a 7.940 artigos prontos | `LICENSE`: CC BY 4.0; `LICENSE-CODE`: MIT | Corpus de suporte TI, após seleção e revisão de aplicabilidade |
| Wix/WixQA | 6.221 artigos; 200 ExpertWritten; 200 Simulated; 6.221 Synthetic | MIT declarada no card | Benchmark externo com IDs de documentos relevantes |
| ameau01/synthetic-it-support-tickets | 745 incidentes; um split `train` | MIT, arquivo LICENSE com Alexander Meau, 2026 | Desenvolvimento e testes de importação, anonimização e recuperação de casos |
| MeneerJohn/synthetic-it-support-tickets | 745 incidentes no viewer; mesma descrição e esquema geral | MIT declarada e arquivo LICENSE presente | Espelho alternativo; preferir a publicação citada pelo autor acima |

Fontes: [árvore Microsoft na revisão consultada](https://api.github.com/repos/MicrosoftDocs/SupportArticles-docs/git/trees/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4?recursive=1), [licença de conteúdo](https://github.com/MicrosoftDocs/SupportArticles-docs/blob/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/LICENSE), [licença de código](https://github.com/MicrosoftDocs/SupportArticles-docs/blob/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/LICENSE-CODE), [card Wix](https://huggingface.co/datasets/Wix/WixQA/blob/d662dc42479c14e202eccd832f8c4b66a035c4cc/README.md), [contagens Wix na API oficial](https://datasets-server.huggingface.co/size?dataset=Wix%2FWixQA), [card do autor dos incidentes](https://huggingface.co/datasets/ameau01/synthetic-it-support-tickets/blob/e5ebd6c6bb955c136c9f45b6fe1503d8331d0a91/README.md), [contagens de incidentes](https://datasets-server.huggingface.co/size?dataset=ameau01%2Fsynthetic-it-support-tickets), [licença MIT dos incidentes](https://huggingface.co/datasets/ameau01/synthetic-it-support-tickets/blob/e5ebd6c6bb955c136c9f45b6fe1503d8331d0a91/LICENSE), [metadados do espelho](https://huggingface.co/api/datasets/MeneerJohn/synthetic-it-support-tickets).

### Revisões para reprodução

| Repositório | SHA obtido na API em 13/11/2026 |
|---|---|
| MicrosoftDocs/SupportArticles-docs | `53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4` |
| Wix/WixQA | `d662dc42479c14e202eccd832f8c4b66a035c4cc` |
| ameau01/synthetic-it-support-tickets | `e5ebd6c6bb955c136c9f45b6fe1503d8331d0a91` |
| MeneerJohn/synthetic-it-support-tickets | `8c2dec0e54e9385b19dae9c47a1cf4f3fa322b4c` |

Endpoints de origem: [Microsoft commit](https://api.github.com/repos/MicrosoftDocs/SupportArticles-docs/commits/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4), [Wix metadata](https://huggingface.co/api/datasets/Wix/WixQA), [autor metadata](https://huggingface.co/api/datasets/ameau01/synthetic-it-support-tickets), [espelho metadata](https://huggingface.co/api/datasets/MeneerJohn/synthetic-it-support-tickets). As APIs sem revisão podem mudar; os downloads abaixo fixam a revisão.

### Correções em relação à pesquisa anterior

- O artigo científico WixQA cita **6.222** exemplos sintéticos; a publicação atualmente distribuída e a API do Hugging Face têm **6.221**. A avaliação deve registrar o tamanho efetivamente carregado, não copiar a contagem do paper. [Paper original](https://arxiv.org/abs/2505.08643), [tamanhos publicados](https://datasets-server.huggingface.co/size?dataset=Wix%2FWixQA).
- Os arquivos Wix se chamam `test.jsonl`, mas a configuração do card não nomeia os splits. O servidor os apresenta como **`train`**. Não existe uma separação automática treino/dev/test a ser presumida pelo importador. [Card fixado](https://huggingface.co/datasets/Wix/WixQA/blob/d662dc42479c14e202eccd832f8c4b66a035c4cc/README.md), [splits oficiais](https://datasets-server.huggingface.co/splits?dataset=Wix%2FWixQA).
- O corpus Wix tem seis campos, incluindo `title` e `html_content`, além dos quatro destacados no card. O contrato deve seguir o arquivo/API validado. [Esquema do corpus na API](https://datasets-server.huggingface.co/rows?dataset=Wix%2FWixQA&config=wix_kb_corpus&split=train&offset=0&length=1).

## 2. Amostra concreta de TI para importar

Foram baixados somente cinco artigos públicos, cerca de 30 KB, para `test-results/pesquisa-datasets/microsoft-support/`. O `manifest.json` local registra URL exata, URL publicada verificada, SHA de revisão, tamanho e SHA-256 de cada arquivo. Nenhum deles foi inserido na central de conhecimento por esta pesquisa.

| Arquivo de origem | Produto em `appliesto` | `ms.date` | Página publicada verificada |
|---|---|---|---|
| `Teams/teams-sign-in/resolve-sign-in-errors.md` | Microsoft Teams | 10/20/2025 | [Erros de entrada](https://learn.microsoft.com/en-us/troubleshoot/microsoftteams/teams-sign-in/resolve-sign-in-errors) |
| `Teams/teams-sign-in/sign-in-loop.md` | Microsoft Teams | 03/02/2026 | [Teams não carrega](https://learn.microsoft.com/en-us/troubleshoot/microsoftteams/teams-sign-in/sign-in-loop) |
| `Teams/teams-administration/clear-teams-cache.md` | Classic Microsoft Teams; New Microsoft Teams | 09/14/2026 | [Cache do Teams](https://learn.microsoft.com/en-us/troubleshoot/microsoftteams/teams-administration/clear-teams-cache) |
| `Outlook/classic-outlook-for-windows/authentication/outlook-shows-disconnected-after-enabling-modern-authentication.md` | Outlook; Microsoft 365 | 01/30/2024 | [Outlook desconectado](https://learn.microsoft.com/en-us/troubleshoot/outlook/authentication/outlook-shows-disconnected-after-enabling-modern-authentication) |
| `support/windows-client/installing-updates-features-roles/troubleshoot-windows-update-issues.md` | Supported versions of Windows Client | 02/12/2026 | [Diagnóstico do Windows Update](https://learn.microsoft.com/en-us/troubleshoot/windows-client/installing-updates-features-roles/troubleshoot-windows-update-issues) |

Exemplo de download reproduzível: [Markdown de erros de entrada, revisão fixa](https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/Teams/teams-sign-in/resolve-sign-in-errors.md). Para os outros quatro, substituir somente o caminho após o SHA pelos caminhos da tabela.

Os cinco têm público ITPro, com diferença de capitalização no Windows. O importador precisa preservar `title`, `description`, `appliesto`, `ms.date`, `audience`, seções e avisos. A data editorial não deve ser confundida com comprovação de atualidade técnica. O documento de cache avisa que esse procedimento não resolve certos problemas de mensagens/canais e pode eliminar logs necessários ao diagnóstico. O de entrada inclui diagnóstico reservado a administrador Microsoft 365. Esses artigos exigem curadoria para uso por funcionários. [Cache e restrições](https://learn.microsoft.com/en-us/troubleshoot/microsoftteams/teams-administration/clear-teams-cache), [privilégios do diagnóstico](https://learn.microsoft.com/en-us/troubleshoot/microsoftteams/teams-sign-in/resolve-sign-in-errors).

No Windows, `appliesto` contém uma tag HTML de link; extrair o texto e preservar a referência, sem transformar a tag em nome de produto nem renderizá-la diretamente. O artigo inclui comandos de administrador e referências a outros documentos que não foram baixados; sua presença na amostra é para testar ingestão, não aprovação automática de procedimentos. SHA-256 do Markdown Windows: `d3d3db5d0d0aaf6ce225b81678f7cf95ca172e995c0068890db60d89be0e0e78`. [Origem fixa](https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/support/windows-client/installing-updates-features-roles/troubleshoot-windows-update-issues.md).

Uma candidata foi rejeitada da amostra: `keep-windows-up-to-date.md` traz data editorial de 2026, mas o corpo declara Windows XP e apresenta passos com Internet Explorer. Esse caso demonstra por que não aprovar artigos apenas por serem oficiais ou terem data recente. [Página inspecionada](https://learn.microsoft.com/en-us/troubleshoot/windows-client/installing-updates-features-roles/keep-windows-up-to-date).

Há uma relação verificável sem modelo: `resolve-sign-in-errors.md` aponta para `sign-in-loop.md`. Resolver o href relativamente ao diretório do primeiro arquivo produz o segundo nó. Isso é uma relação **cita**, não prova de mesma causa ou mesma solução. Includes como `../../includes/third-party-information-disclaimer.md` devem ser tratados como dependências editoriais, não como artigos recomendáveis. [Markdown de origem](https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/Teams/teams-sign-in/resolve-sign-in-errors.md), [artigo que contém include](https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/Teams/teams-sign-in/sign-in-loop.md).

Não derivar a URL publicada simplesmente removendo `.md`: o `docfx.json` de Outlook remapeia diretórios de origem, incluindo `classic-outlook-for-windows`, para a raiz do docset. Manter `sourceUrl` imutável e `canonicalUrl` validada separadamente; se a canonical for desconhecida, mostrar a origem do GitHub. [Configuração de publicação de Outlook](https://github.com/MicrosoftDocs/SupportArticles-docs/blob/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/Outlook/docfx.json).

### Contrato de normalização proposto

```typescript
type SupportDocument = {
  id: string; // namespace + caminho estável, separado da revisão
  source: "microsoft-support" | "wixqa" | "synthetic-itsm";
  revision: string;
  sourcePath: string;
  sourceUrl: string;
  canonicalUrl?: string;
  license: string;
  attribution: string;
  sha256: string;
  language: string;
  title: string;
  body: string;
  products: string[];
  audience?: string;
  sourceUpdatedAt?: string;
  reviewStatus: "pending" | "approved" | "rejected";
};

type SupportEdge = {
  sourceId: string;
  targetId: string;
  relation: "applies_to" | "references";
  evidence: { sourcePath: string; revision: string; fieldOrHref: string };
};
```

Esse é um contrato sugerido, não descrição de código já integrado. Produtos sem referência explícita não devem ser inventados a partir do título. Arestas para destinos ausentes podem ficar como referências externas, sem dar aparência de documento já indexado. Uma relação por produto pode gerar muitos vizinhos; limitar expansão e exigir pontuação da consulta evita recomendar todos os artigos de Teams.

Atribuir Microsoft e colaboradores, manter link da licença CC BY 4.0, origem e indicação de modificações/traduções. Separar o conteúdo externo da licença do código do Farol. [Condições publicadas na licença](https://github.com/MicrosoftDocs/SupportArticles-docs/blob/53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4/LICENSE).

## 3. Dados com perguntas, respostas e resoluções

### WixQA: benchmark externo

Downloads fixos, ainda não baixados integralmente nesta pesquisa:

- [Corpus JSONL, 6.221 artigos](https://huggingface.co/datasets/Wix/WixQA/resolve/d662dc42479c14e202eccd832f8c4b66a035c4cc/wix_kb_corpus/wix_kb_corpus.jsonl).
- [ExpertWritten, 200 casos](https://huggingface.co/datasets/Wix/WixQA/resolve/d662dc42479c14e202eccd832f8c4b66a035c4cc/wixqa_expertwritten/test.jsonl).
- [Simulated, 200 casos](https://huggingface.co/datasets/Wix/WixQA/resolve/d662dc42479c14e202eccd832f8c4b66a035c4cc/wixqa_simulated/test.jsonl).
- [Synthetic, 6.221 casos](https://huggingface.co/datasets/Wix/WixQA/resolve/d662dc42479c14e202eccd832f8c4b66a035c4cc/wixqa_synthetic/test.jsonl).

Contrato observado:

```text
Corpus: id, url, contents, title, html_content, article_type
QA: question, answer, article_ids: string[]
```

O índice recebe somente o corpus. O avaliador recebe `article_ids`; `answer` nunca vira documento nem pista para recuperação. `html_content` é dado não confiável, a ser convertido/sanitizado; não renderizar HTML arbitrário no console. Artigos do tipo solicitação de recurso ou problema conhecido não significam solução existente. [Esquema e tipos publicados](https://huggingface.co/datasets/Wix/WixQA/blob/d662dc42479c14e202eccd832f8c4b66a035c4cc/README.md).

A recomendação é desenvolver com Synthetic e congelar a configuração antes de medir ExpertWritten. O benchmark é de atendimento Wix em inglês e está vinculado ao snapshot publicado; não misturar artigos atuais coletados do site com os IDs e respostas antigos. Essa avaliação testa transferência do mecanismo de busca para um corpus externo; não valida procedimentos de TI da empresa. [Dataset e snapshot](https://huggingface.co/datasets/Wix/WixQA/blob/d662dc42479c14e202eccd832f8c4b66a035c4cc/README.md).

Transparência sobre cegamento: a abertura inicial da página pública do dataset nesta pesquisa expôs exemplos antes da decisão de reservar o gold. Não foram usados para ajustar um recuperador. Não afirmar que os 200 casos ficaram inteiramente invisíveis ao agente. Para um teste estritamente cego, registrar/excluir exemplos expostos e reservar um conjunto não inspecionado, ou usar um novo lote humano selado. Não continuar lendo respostas para construir regras específicas.

### Incidentes sintéticos: desenvolvimento, não resultado de cliente

Preferir o repositório citado pelo autor. [Parquet fixo, 745 registros](https://huggingface.co/datasets/ameau01/synthetic-it-support-tickets/resolve/e5ebd6c6bb955c136c9f45b6fe1503d8331d0a91/data/train.parquet). A publicação fornece resolução e diagnóstico, mas é explicitamente sintética. O card também disponibiliza gabaritos para remoção de identificadores e preservação de termos técnicos. [Card](https://huggingface.co/datasets/ameau01/synthetic-it-support-tickets/blob/e5ebd6c6bb955c136c9f45b6fe1503d8331d0a91/README.md).

```text
record_id, record_type, status
ticket: submitted_at, submitted_title, submitted_description,
        priority, sla_plan, environment, applications[]
correspondence[]: turn_id, role, event_type, message, timestamp
diagnostics: coverage, summary, observed_errors[], steps[]
root_cause: string
resolution: { steps: string[] }
```

Esquema conferido na [API de linhas do autor](https://datasets-server.huggingface.co/rows?dataset=ameau01%2Fsynthetic-it-support-tickets&config=default&split=train&offset=0&length=1). Não há wiki pronta nem qrels artigo-pergunta nessa publicação. É necessário construir e revisar a relação entre um incidente de consulta e incidentes históricos úteis; similaridade textual não é um gabarito confiável de solução.

Para a consulta, usar só informações disponíveis na abertura do chamado. `root_cause`, diagnóstico posterior, conversa de resolução e `resolution.steps` do próprio chamado são **gabarito**, não contexto de entrada. A memória pode conter casos antigos distintos, após separação por família/causa e tempo. Os exemplos iniciais mostram variações próximas; o export não fornece as famílias de geração. Deduplicar e agrupar por erro, produto e causa, com revisão, antes de dividir. Evitar um split aleatório que coloque paráfrases da mesma solução em treino e teste. [Escopo e campos omitidos no export](https://huggingface.co/datasets/ameau01/synthetic-it-support-tickets/blob/e5ebd6c6bb955c136c9f45b6fe1503d8331d0a91/README.md).

O card declara que os identificadores são sintéticos. Mesmo assim, o exercício serve para testar o sanitizador: remover dados marcados em `pii.json` sem destruir os termos de `retention.json`. Não carregar o diretório de usuários sintéticos como identidade da aplicação. A identidade continua vindo da sessão do Farol.

## 4. Integração offline, sem consumir o teto de modelos

Plano técnico proposto para implementação, não comandos já existentes no projeto:

1. **Manifesto versionado:** allowlist de repositório e caminhos, revisão, licença, atribuição, limite de bytes e SHA-256. Downloads e índices em diretório de experimento, fora do banco de produção.
2. **Importador local:** parse de Markdown/frontmatter ou JSONL; IDs determinísticos; quarentena de registros inválidos; normalização de links sem acessar arbitrariamente destinos indicados pelo documento. Não resolver caminhos que escapem da raiz permitida.
3. **Revisão:** começar com 20–50 artigos TI pertinentes, separar público funcionário/técnico, preservar pré-condições, contraindicações e diferenças de versão. A amostra de cinco arquivos prova o formato, não a cobertura do produto.
4. **Índice e grafo:** BM25 local; export `documents.jsonl`, `nodes.jsonl`, `edges.jsonl`, manifesto e relatório de rejeições. Produto vem de metadados; links vêm do documento. Não é necessário instalar Neo4j para esse primeiro experimento.
5. **Busca:** top candidatos lexicais; opcional expansão de um salto por referências, seguida de reranking e limite de documentos. Calibrar pesos somente no desenvolvimento. Registrar caminho que trouxe cada artigo para explicar a contribuição do grafo.
6. **Runner offline:** consultas congeladas, resultados por método, métricas, latência e versão. Falhar se a execução tentar acionar API paga. Comparar BM25 versus BM25+grafo em CPU agora; uma terceira variante híbrida densa só entra se já houver embeddings compatíveis ou após disponibilizar modelo local apropriado e validado.
7. **Integração no produto:** somente depois da medição, conectar o adaptador pela porta de conhecimento existente; publicar artigos revisados com origem e proveniência visíveis. Preservar a autorização atual e separar corpus por organização quando houver dados privados.

Não chamar BM25+grafo de busca vetorial, nem de implementação do pacote Microsoft GraphRAG. Também não chamar extração de nós de RAG completo: ainda falta demonstrar que o agente usa a evidência para responder e executar o fluxo correto. Inglês no corpus e português na consulta precisam de medição própria; uma lista manual de sinônimos pode ser baseline, mas não demonstra recuperação multilíngue geral.

Testes úteis para o importador: integridade do SHA, repetição idempotente, licença/proveniência preservadas, Unicode e listas do frontmatter, link relativo resolvido corretamente, include não tratado como solução, aresta inexistente não inventada, caminho externo rejeitado e nenhuma chamada ao fornecedor de modelos. Para a recuperação, testar ranking e abstenção com casos que não repliquem literalmente o título do artigo.

## 5. Como provar eficácia real

Os números históricos registrados em `BASE-DE-CONHECIMENTO.md` são evidência de desenvolvimento do conjunto pequeno daquela data. Eles não substituem uma avaliação externa nem um piloto de chamados reais. Esta pesquisa não executou uma nova avaliação do agente.

### Experimento comparável

| Variante | Objetivo | Execução agora |
|---|---|---|
| A — BM25 | Baseline lexical que preserva códigos de erro e nomes | CPU, sem modelo |
| B — híbrida lexical + vetorial | Ganho em paráfrase e idioma | Apenas com embeddings/modelo já disponíveis sem cobrança; caso contrário adiar |
| C — mesma base de A ou B + grafo explícito | Ganho incremental atribuível às relações | CPU para a expansão; comparar C-A e, futuramente, C-B |

Fixar corpus, fragmentação, k, orçamento de contexto e perguntas entre variantes. Se comparar C com B usando índices diferentes, não atribuir o ganho ao grafo. Publicar número de documentos, arestas, consultas, revisão e parâmetros. Separar erro de recuperação de erro de resposta: artigo correto encontrado e resposta errada são falhas distintas.

### Separação dos dados e prevenção de vazamento

- Guardar manifesto/hash de corpus, desenvolvimento e teste antes de medir. Adaptar prompts, sinônimos, limiares e pesos somente com desenvolvimento; teste deixa de ser cego quando suas falhas viram novos ajustes.
- Para corpus de incidentes: agrupar duplicatas, família de causa e versões; aplicar corte temporal antes da avaliação. Nenhum evento posterior à consulta pode fornecer uma pista ao agente.
- Para documentação: o índice contém documentos, mas não perguntas/respostas de teste. O autor do gabarito precisa validar os trechos que de fato sustentam a solução, inclusive quando são necessários vários artigos.
- Incluir estratos com código exato, paráfrase, português com documentação inglesa, múltiplas evidências, versão incompatível, conhecimento ausente e ação que exige escalonamento.
- No holdout do Farol, usar chamados desidentificados que não participaram do desenvolvimento. Se ainda não houver chamados reais disponíveis, rotular o conjunto como simulado/humano de laboratório e não publicar taxa de resolução de clientes.

### Métricas e o que cada uma prova

| Métrica | Cálculo/observação | Limite |
|---|---|---|
| Recall@k | Documentos relevantes recuperados dividido pelo total relevante; média por consulta | Exige gabarito de documentos; medir por artigo, deduplicando chunks |
| Hit@k e MRR@k | Encontrou ao menos um relevante; inverso da posição do primeiro relevante | Podem esconder ausência do segundo artigo necessário |
| Todas as evidências@k | Fração de consultas em que todo o conjunto obrigatório está presente | Essencial nos casos de múltiplos documentos |
| Precisão de resposta e citações | Revisão humana da correção, sustentação e aplicabilidade | Similaridade com resposta de referência não basta |
| Abstenção | Precisão dos casos respondidos, cobertura e taxa de resposta indevida nos sem evidência | Abster sempre melhora segurança aparente, mas zera utilidade |
| Resolução operacional | Resultado confirmado por usuário/técnico, ausência de reabertura em janela definida e fluxo correto | Encontrar um artigo ou fechar ticket automaticamente não prova resolução |
| Custo e tempo | p50/p95, custo por consulta e por resolução confirmada, tempo do técnico e escalonamentos | Contabilizar também indexação e revisão humana |

No desenvolvimento, escolher o limiar de abstenção por curva precisão/cobertura e risco do procedimento. Congelar antes do teste. Uma pergunta sobre produto desconhecido ou procedimento de administrador deve admitir encaminhamento correto como resultado esperado, não forçar uma resposta.

### Amostra humana e piloto

Proposta inicial, não cálculo de poder estatístico: **60–100 casos novos em português**, distribuídos entre os estratos acima, anotados por suporte. Dois revisores classificam correção, evidência, ação segura e necessidade de escalonamento; um terceiro resolve divergências. Separar desenvolvimento e teste antes que o implementador leia as soluções do teste. Um lote desse tamanho revela falhas importantes, mas pode não comprovar ganhos pequenos.

Depois, executar piloto em modo de sugestão ao técnico com chamados reais autorizados. Registrar resultado confirmado e reabertura, controlar dificuldade/categoria, comparar tempo de atendimento e taxa de solução contra a operação sem sugestão. Randomização por chamado ou uma comparação temporal cuidadosamente controlada é mais informativa que escolher apenas exemplos bem-sucedidos. O critério de sucesso deve ser definido antes de olhar os resultados.

Comparar variantes de forma pareada; apresentar intervalos de confiança por bootstrap agrupado por família de incidente, além da média. Não anunciar ganho quando o intervalo for inconclusivo ou quando houver regressão em procedimentos sensíveis. Meta inicial sugerida para investigar o grafo: ganho de recuperação completa em casos de múltiplas evidências sem piorar precisão, abstenção ou latência aceitável. O tamanho mínimo de ganho aceitável deve ser acordado a partir do custo operacional do Farol, não extraído de um benchmark de outro domínio.

## Resultado desta pesquisa

Há dados públicos adequados para começar a integração: documentação Microsoft para conhecimento de TI; WixQA para medir recuperação fora do conjunto escrito pelo próprio projeto; incidentes sintéticos com resolução para desenvolvimento. Foram entregues cinco artigos reais e um manifesto local verificável para testar o importador. Não foi estabelecida conexão com um sistema de chamados de cliente nem executado benchmark completo.

O próximo resultado demonstrável é: **importar, buscar, explicar a origem e medir o ganho do grafo sem chamadas pagas**. A afirmação de eficácia real depende depois de gabarito independente e resultados confirmados em chamados reais. Microsoft GraphRAG completo continua sendo uma hipótese futura, não requisito para concluir essa primeira integração.
