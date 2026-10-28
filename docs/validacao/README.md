# Provas de eficácia

Cada melhoria grande tem uma pergunta, um método que outra pessoa pode repetir, os números e os limites. Os testes de unidade e E2E rodam sem LLM. O que depende do modelo roda com o Gemini 3.5 Flash de verdade.

| O que | Pergunta | Resultado | Como repetir |
|---|---|---|---|
| [Busca na central](BUSCA.md) | A busca híbrida acha mais artigos certos, sem responder com artigo sem relação? | Acerto geral **84% → 94%** em 50 perguntas; no conjunto separado, hit@1 92% → 100% | `npm run eval:busca` |
| [Tempo real](TEMPO-REAL.md) | O stream SSE entrega mais rápido que o polling, e o polling ainda segura se o stream cair? | Mediana **263–580 ms** × 1505–1684 ms; p95 < 1 s; o fallback funciona | `npx playwright test e2e/live.spec.ts` |
| [Red-team](RED-TEAM.md) | O agent resiste a injeção, vazamento, ação sem confirmação e desvio? | 7 ataques × 3 = **21/21**; injeção indireta pela central 3/3; mapeados ao OWASP | `npm run eval -- ataque --repeat=3` |
| [Telemetria e SSO](OBSERVABILIDADE-E-SSO.md) | A telemetria segue o padrão e não vaza dado pessoal? O SSO recusa token forjado? | Spans GenAI recebidos de um turno real, 0 dado pessoal; SSO recusa 8 tipos de token ruim; fluxo completo no navegador | `npm run otel:local` · `npx playwright test e2e/sso.spec.ts` |
| Sugestão de resposta | O rascunho para o analista inventa número ou ação? | **9/9** em 3 conversas × 3, sem número inventado; mediana 6,2 s | `npm run eval:sugestao` |
| Incidente em massa | Com 3 pessoas relatando, o rascunho sobe o impacto sem revelar quem são? | **3/3** com o modelo real; regra com 8 testes de unidade | `npm run eval -- "incidente em massa" --repeat=3` |
| Frustração | Frustração alta oferece analista sem transferir? Pergunta neutra não oferece? | **6/6**, depois de mover a oferta para o código (antes, 2/3) | `npm run eval -- frustração --repeat=3` |
| Resolução honesta e lacunas | A taxa de resolução desconta chamado, abandono e reabertura? As lacunas mascaram dados pessoais? | Regras com testes de unidade; E2E confere os grupos e a lacuna do seed | `npm test` · `npx playwright test e2e/insights.spec.ts` |
| Suíte de evals | O agent toma a decisão certa nos 31 cenários (8 de ataque, 5 dos achados do funcionário simulado)? | **31/31** na rodada completa de 28/10, depois das correções, sem falha do provedor | `npm run eval` |
| [Funcionário simulado](SIMULACAO.md) | O agent acerta o estado final em várias execuções seguidas (pass^k)? | Antes: pass^1 **0,72** · pass^3 **0,50** (6 personas). Depois das correções: **0,93 / 0,80** com 10 personas (28/30), e **0,97 / 0,90** com a persona que falhou por erro da checagem repetida; 1 falha real de prioridade | `npm run eval:sim` |

## O que os evals pegaram nesta rodada

- **Frustração:** o modelo esquecia de oferecer o analista em 1 de 3 execuções. A oferta virou código (um botão), e o resultado subiu para 3/3.
- **Telemetria:** mostrou 6 chamadas paralelas de `recordUnderstanding` num turno, invisíveis no console. Ficou registrado como próximo ajuste.
- **Runner dos evals:** quando o Gemini devolvia 503 dentro do stream, o Mastra respondia com a mensagem reserva e o uso zerado, e um ataque podia "passar" sem o modelo ter respondido. Agora isso conta como falha do provedor.
- **Seed:** a lacuna de exemplo era sobre impressora, mas a central tem um artigo de impressora. O exemplo foi trocado por projetor.
- **Limite de mensagens no runner:** 15 "erros do provedor" de uma rodada eram, na verdade, o limite do próprio app (40 mensagens por hora por pessoa), porque todos os cenários usavam os mesmos funcionários. Agora o runner libera a janela antes de cada cenário e só repete falha do provedor. A suíte voltou a dar 26/26.
- **Correções do funcionário simulado:** os quatro achados viraram regra em código com teste (confirmação explícita, assunto do chamado, Outlook como E-mail, analista só quando o prazo não atende), cinco cenários novos e quatro personas novas. As 6 personas da primeira rodada passaram 18/18. A checagem de confirmação do harness também estava errada (não contava "Sim, pode criar" como confirmação) e foi corrigida ([detalhes](SIMULACAO.md)).
- **Simulação com estado herdado:** as repetições do `eval:sim` viam o chamado aberto pela anterior e o tratavam como duplicado. Cada execução agora parte do seed. Com o estado limpo, a simulação achou três comportamentos do agent para corrigir: abrir chamado a partir de uma resposta rápida que não era um "sim", anexar um problema novo ao chamado errado e oferecer analista depois de o chamado já resolver o pedido ([detalhes](SIMULACAO.md)).
