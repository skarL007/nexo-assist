# Avaliação de 29 e 30/10/2026: antes e depois

**Pergunta:** as mudanças de 29 e 30/10 (verificações de diagnóstico, troca para o GPT-6 Luna, sincronização da central, prévia ao compartilhar e o novo provedor dos embeddings) melhoraram o Nexo Assist? Quanto, a que custo, e o que ficou pior?

**Resposta:** melhoraram. O agent resolve um tipo de problema que antes não resolvia (defeito de equipamento com verificações guiadas), acerta todos os cenários de decisão e custa 95% menos por cenário de eval. A busca em produção, que tinha caído para 75% quando os créditos do Google acabaram, volta a 92% pelo OpenRouter, por cerca de US$ 0,012 no teto inteiro da demo. O preço: nas 50 perguntas antigas da busca, o acerto caiu 4 pontos, porque os artigos novos de diagnóstico passaram a atrair perguntas parecidas.

"Antes" é o `e805fb0` (29/10, 13h), o último commit antes dessas mudanças. "Depois" é o `main` com as mudanças abaixo.

## O que mudou

| Commit | Mudança |
|---|---|
| `48f8a42` | Verificações de diagnóstico: 5 artigos KCS (14 na central), `askDiagnosticCheck` (até 3 por conversa) e o "já tentado" escrito no chamado a partir do histórico |
| `d0faf90` | Cenário de eval do Power BI ajustado para o GPT-6 Luna, que segue o autoatendimento antes do rascunho |
| `02d93be` | `syncArticles`: a central é atualizada no deploy sem apagar conversas, chamados nem contadores |
| `1d0e0c5` | Documentação com os números do Luna |
| `e8a914c` | Prévia ao compartilhar (Open Graph e cartão do X) e link "Sobre este protótipo" para o estudo de caso |
| `52a45b0` | Embeddings pelo OpenRouter, com o Gemini direto de reserva e disjuntor por provedor ([BUSCA.md](BUSCA.md#provedor-dos-embeddings-30102026)) |

## Antes e depois

| O que | Antes | Depois | Mudança | Fonte |
|---|---|---|---|---|
| Decisões do agent (evals, 1 rodada) | 31/32 = 96,9% (Gemini 3.5 Flash) | 36/36 = 100% (GPT-6 Luna); nos 32 cenários antigos, 32/32 | +3,1 pontos | [README](README.md), rodadas de 29/10 e 30/10 |
| Custo por cenário de eval | US$ 0,024 (US$ 0,77 por 32) | US$ 0,0011 (US$ 0,04 por 36) | **−95%** | idem |
| **Busca em produção** (63 perguntas) | 47/63 = 75% (só palavras: Google sem crédito, 402) | **58/63 = 92%** (híbrida pelo OpenRouter) | **+17 pontos** | `npm run eval:busca` |
| Busca só por palavras, mesmo código de busca (63 perguntas) | 43/63 = 68% (9 artigos) | 47/63 = 75% (14 artigos) | +7 pontos | medição de 30/10, abaixo |
| ↳ perguntas de defeito de equipamento (13) | 1/13 = 8% | 7/13 = 54% | +46 pontos | idem |
| ↳ as 50 perguntas antigas | 42/50 = 84% | 40/50 = 80% | −4 pontos | idem |
| Busca híbrida, as 50 perguntas antigas | 47/50 = 94% | 45/50 = 90% | −4 pontos | [BUSCA.md](BUSCA.md) |
| Busca híbrida, perguntas de equipamento (13) | — (os artigos não existiam) | 13/13 = 100% | novo | idem |
| Funcionário simulado (pass^1 / pass^3) | 0,93 / 0,80 (Gemini) | não medido com o Luna | ? | [SIMULACAO.md](SIMULACAO.md) |
| Testes unitários / E2E | 443 / 39 | 466 / 42 | +23 / +3 | `npm test` · `npm run test:e2e` |

O que não vira porcentagem:

- **Diagnóstico guiado:** antes, "computador não liga" ia direto para um chamado. Agora o agent pede até 3 verificações seguras, uma por vez, com botões, e o que já foi tentado entra no chamado para o analista não perguntar de novo.
- **Central atualizada sem perder dados:** antes, só o seed levava artigos novos a um banco existente, e o seed apaga as conversas. Agora o deploy da Vercel e a subida do contêiner no Komodo sincronizam os artigos.
- **Quem recebe o link da demo:** vê a tela do produto na prévia do LinkedIn ou do WhatsApp e chega ao estudo de caso pelo link "Sobre este protótipo".
- **Busca sem um ponto único de falha:** dois provedores do mesmo modelo, um disjuntor que não insiste num provedor sem crédito e as palavras-chave como último recurso.

## A decisão sobre os embeddings

Os créditos pré-pagos do Google acabaram em 29/10. O LLM da demo já tinha ido para o GPT-6 Luna pelo OpenRouter, mas os embeddings da busca continuavam só no Google, e a produção passou a buscar só por palavras sem ninguém perceber pela interface (o trace mostrava "busca só por palavras").

| Opção | Busca (63 perguntas) | Custo no teto da demo | Por que sim ou não |
|---|---|---|---|
| **`google/gemini-embedding-2` pelo OpenRouter, Gemini direto de reserva** | **92%** | **~US$ 0,012** | Mesmo modelo, mesma margem, sem recalibrar; usa a chave que já tem saldo; o Google vira reserva independente. **Escolhida** |
| `baai/bge-m3` pelo OpenRouter | 87% | ~US$ 0,0006 | 3 acertos a menos, margem nova (0,04) e o mesmo provedor da opção escolhida: não protege contra o OpenRouter fora do ar. A economia é de cerca de 1 centavo |
| Só recarregar o Google | 92% | crédito pré-pago | Resolve hoje, mas mantém um ponto único de falha. Na opção escolhida, recarregar vira reforço da reserva |
| Modelo local (transformers.js) | não medido | zero | Cerca de 100 MB a mais na função da Vercel e partida a frio mais lenta, sem medição em português. Exagero para 14 artigos |
| Ficar só com palavras | 75% | zero | 17 pontos a menos; erra 6 das 13 perguntas de equipamento |

Os cinco modelos medidos, a margem de cada um e a leitura estão em [BUSCA.md](BUSCA.md#provedor-dos-embeddings-30102026).

**Desempenho:** mediana de 994 ms por pergunta, máximo de 1,4 s (10 perguntas, medidas daqui do Brasil; as funções da Vercel rodam em `iad1`, e a latência de lá não foi medida). A chamada tem tempo máximo de 4 s. Os vetores dos 14 artigos são calculados uma vez e ficam no banco; depois, só a pergunta vira vetor.

**Custo:** US$ 0,20 por 1M tokens. Uma pergunta custa cerca de US$ 0,0000014, e o teto total da demo (2000 turnos) cerca de US$ 0,012. A medição dos cinco modelos custou US$ 0,0004.

## Como medi

- **Busca:** as 63 perguntas de [`evals/retrieval/queries.ts`](../../evals/retrieval/queries.ts) (33 de calibração, 17 do conjunto separado e 13 de equipamento), a mesma busca do app e a mesma margem. A comparação "só palavras, antes e depois" foi um script de uma vez: em uma cópia do `e805fb0` e no `main`, `hybridSearch` sem vetores, com os artigos e o código de cada commit e as perguntas do `main`. Não chama API e dá sempre o mesmo resultado.
- **Provedores de embeddings:** [`compare-models.ts`](../../evals/retrieval/compare-models.ts) e `npm run eval:busca`.
- **Decisões do agent:** os números registrados das rodadas de 29/10 (Gemini) e 30/10 (Luna).
- **Testes:** contam como proteção contra regressão, não como qualidade.

## Limites

- **O +3,1 dos evals mistura duas coisas:** o modelo mudou junto com o código, e cada número é de uma rodada só (uma rodada varia cerca de ±1 cenário). Para separar, seria preciso rodar `npm run eval` no `e805fb0` e no `main` com o mesmo modelo, 3 vezes cada (~US$ 0,25 no Luna).
- **O funcionário simulado não foi rodado com o Luna**, porque o simulador usa o Gemini pelo Google, sem crédito.
- **Chamados evitados pelo diagnóstico:** não há dado de uso real, então não há porcentagem.
- **Margem pelo OpenRouter:** a faixa estável é mais estreita (0,015 a 0,02). Com artigos novos, é o primeiro número a remedir.
- **Komodo:** a stack local não recebe a `OPENROUTER_API_KEY` ([DEPLOY.md](../DEPLOY.md)). Ali a busca continua dependendo do Google e, sem crédito, fica com as palavras-chave.
