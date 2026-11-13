# Imersão do Farol e corpus Microsoft — 13/11/2026

## Escopo entregue

O usuário restringiu o polimento visual à cena de rolagem `#imersao`. Foram preservados os renders existentes do Blender, com enquadramentos próprios para desktop e celular. A camada visual ganha parallax suave com o ponteiro e atmosfera âmbar discreta; texto e controles permanecem estáveis. São imagens de uma cena 3D pré-renderizada, não geometria WebGL em tempo real. A barra fica transparente sobre o trecho escuro e volta ao estilo claro ao sair. Três capítulos permitem avançar pelo teclado ou toque, e o link Pular cena mantém acesso direto à explicação do produto.

O movimento respeita `prefers-reduced-motion`; dispositivos de toque não inclinam a cena. Sem canvas ou se nenhum quadro da sequência carrega, o pôster e as três frases ficam disponíveis. O restante da landing e as telas do produto preservam seu layout. Referência de direção: [Igloo Inc no Awwwards](https://www.awwwards.com/sites/igloo-inc), pelo uso de profundidade, transições e paleta contida; nenhum asset foi copiado.

## Evidência técnica

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test`: 586 testes em 79 arquivos passaram.
- `npx playwright test --output=test-results/entrega-imersao-e2e`: 72 testes passaram, incluindo login, console, mobile, acessibilidade e os novos controles da cena.
- TDD da cena: três testes inicialmente falharam pela ausência de capítulos/fallback; um teste adicional de barra transparente falhou antes da alteração.
- Inspeção visual: 1440 × 900 e 390 × 844, nos três momentos da tomada. Nenhum erro JavaScript observado. Capturas locais em `test-results/immersion-{desktop,middle,last,mobile}.png` (não versionadas).
- axe WCAG 2.1 A/AA na cena com movimento e na suíte existente de páginas com movimento reduzido: nenhuma violação detectada. Isso não equivale a certificação de acessibilidade.

## Dados e avaliação

O laboratório importou cinco artigos oficiais de Microsoft Teams, Outlook e Windows Update. Revisão fixa: `53a6ab748bdc2c4e916e906d7d20696e0fc7eeb4`. Duas importações retornaram o mesmo hash de corpus: `d9e659dac1df8ebe1aedb79bf2045afcad189a041b01dd3f941e3e5c55a962d4`.

O grafo tem cinco artigos, seis produtos, sete vínculos de produto e uma referência explícita entre artigos. A busca BM25 com expansão usa somente a referência, sem inventar relações por similaridade de produto. Os doze testes novos cobrem integridade, limites de download, origem permitida, duplicidade, referência relativa/canônica, limite de um salto, abstenção e métricas.

O avaliador foi executado com três casos de desenvolvimento, rotulados como exemplos técnicos, para comprovar o formato e a execução. As duas variantes empataram em Recall@3 e MRR@3 nesses exemplos; **isso não demonstra eficácia real nem vantagem do grafo**. A seleção de cinco artigos tampouco representa o domínio de suporte. O protocolo de avaliação reservada, revisão humana e piloto supervisionado está em [datasets/README.md](../../datasets/README.md) e no [relatório de pesquisa](../pesquisa/DADOS-SUPORTE-E-GRAFO-2026-11-13.md).

Nenhuma chamada adicional de LLM, embedding ou tradução foi executada. O teto de US$ 0,07 não foi alterado. O chat publicado continua com sua base anterior; os dois cenários de agente pendentes e o cenário bloqueado pelo orçamento, registrados na [entrega anterior](ENTREGA-2026-11-13.md), não foram reavaliados nem declarados corrigidos.
