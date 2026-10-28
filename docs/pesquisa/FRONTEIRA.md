# Pesquisa de fronteira: agentes de IA para service desk de TI (2025–2026) e o que levar para o Nexo Assist

Pesquisa feita em 28/10/2026, com todas as URLs acessadas nessa data. A data entre parênteses é a de publicação ou atualização da página; "sem data" indica que a página não informa. **(fonte única)** marca afirmações encontradas em uma só fonte, e **(secundária)** marca afirmações vindas de imprensa ou de terceiros, e não do fornecedor.


> **O que virou código (28/10/2026).** As cinco recomendações foram implementadas e validadas:
> - **R1** funcionário simulado com pass^k: `npm run eval:sim` ([resultado](../validacao/SIMULACAO.md)).
> - **R2** incidente em massa: `domain/known-issue.ts`, eval com o modelo real e banner no console.
> - **R3** resolução honesta: `domain/resolution.ts`, na tela Indicadores.
> - **R4** lacunas da central: `domain/knowledge-gaps.ts`, também em Indicadores.
> - **R5** sinal de frustração: `domain/frustration.ts`, com o chip no console e a oferta de analista.
>
> Do que estava "em andamento" na seção 2.5:
> - **Red-team:** os cenários estão mapeados ao OWASP em [RED-TEAM.md](../validacao/RED-TEAM.md).
> - **Telemetria:** segue as convenções GenAI ([OBSERVABILIDADE-E-SSO.md](../validacao/OBSERVABILIDADE-E-SSO.md)).
> - **SLA:** o aviso explica o porquê.
> - **Sugestão de resposta:** a tela mede quantas foram enviadas iguais e quantas editadas.

---

## 1. Resumo em 5 linhas

1. Entre 2025 e 2026 o mercado trocou "deflexão" por **resolução verificada**: Zendesk, Intercom e Atlassian publicam regras do que conta como resolvido, e algumas usam um juiz LLM separado para confirmar.
2. Os produtos de service desk de TI chegaram ao mesmo pacote: triagem, resumo para o analista, resposta sugerida, artigo gerado de chamado resolvido, lacunas de conhecimento, sentimento e detecção de incidente em massa.
3. Na avaliação, a prática de ponta é usar **usuário simulado**, checar o estado final e avaliar com rubrica, e medir confiabilidade por **pass^k** (τ-bench), não por uma execução só.
4. Em segurança, a referência é o OWASP LLM Top 10 2025 junto com o OWASP Agentic Top 10 (dez/2025) e a ideia de "menor agência"; em observabilidade, as convenções GenAI do OpenTelemetry, ainda em "Development".
5. O Nexo já cobre bem confirmação, transparência e transferência. As melhores apostas de poucas horas são: usuário simulado com pass^k, incidente em massa, métrica de resolução honesta, lacunas da central e sinal de frustração.

---

## 2. O que a fronteira faz

### 2.1 Produtos

**ServiceNow (Now Assist, agora sob a marca Otto) e Moveworks.** A documentação da release Zurich lista 20 skills generativas para ITSM. Entre elas: resumo do chat do Virtual Agent com o analista, resumo de incidente, notas de resolução, **artigo de conhecimento gerado a partir de incidentes resolvidos**, resposta de chat sugerida e **análise de sentimento do solicitante com justificativa** ([docs Zurich](https://www.servicenow.com/docs/bundle/zurich-it-service-management/page/product/now-assist-itsm/concept/using-now-assist-for-itsm.html), sem data). O fluxo agêntico **Explain SLA** encontra o SLA com maior risco e explica pausas, atribuições e causas do atraso ([docs, 12/03/2026](https://www.servicenow.com/docs/r/MlbQAgTiiiMOLOw9T36wJg/3_9S_yoe3oKHBtq9_ZHrwQ)). A compra da Moveworks, com seu assistente conversacional, busca corporativa e Reasoning Engine, foi concluída em 15/12/2025 ([BusinessWire](https://www.businesswire.com/news/home/20251215128980/en/ServiceNow-completes-acquisition-of-Moveworks); [Nasdaq](https://www.nasdaq.com/press-release/servicenow-completes-acquisition-moveworks-2025-12-15)). A marca Otto saiu no Knowledge 2026, em maio de 2026 ([ServiceNow](https://www.servicenow.com/de/platform/otto.html); [eesel, secundária](https://www.eesel.ai/blog/how-to-add-ai-to-servicenow)).

**Salesforce Agentforce IT Service** (09/10/2025). Atende pelo Slack e pelo Teams, cria e prioriza incidentes a partir de relatos e, **quando vários funcionários relatam o mesmo problema de VPN, escala um incidente grave e avisa os afetados** ([Salesforce](https://www.salesforce.com/news/stories/agentforce-it-service-announcement/); [TechTarget](https://www.techtarget.com/searchcustomerexperience/news/366632554/Salesforce-rolls-into-ITSM-with-Slack-based-agentic-AI-platform)). O Testing Center (nov/2024) gera testes sintéticos e avalia o tópico escolhido, a ação executada e o resultado ([Salesforce IR](https://investor.salesforce.com/news/news-details/2024/Salesforce-Introduces-Agentforce-Testing-Center-First-of-Its-Kind-AI-Agent-Lifecycle-Management-Tooling-for-Testing-Autonomous-AI-Agents-at-Scale/default.aspx); [VentureBeat](https://venturebeat.com/ai/salesforce-launches-agentforce-testing-center-to-put-agents-through-paces/)).

**Atlassian (JSM e Rovo).** Os **Suggested topics** olham os pedidos dos últimos 30 dias, ou os 200 mais recentes, e sugerem um artigo quando não há conteúdo relacionado e mais de cinco pedidos tratam do tema. A lista é atualizada toda semana e ignora itens com nível de segurança ([docs](https://support.atlassian.com/jira-service-management-cloud/docs/address-knowledge-gaps-with-suggested-topics/), sem data). O agente Rovo *Service Request Helper* encontra pedidos parecidos, rascunha a resposta, resume e sugere responsável, próximos passos e prioridade ([docs](https://support.atlassian.com/rovo/docs/work-with-service-request-helper/), sem data). No Customer Service Management, uma conversa só conta como resolvida com resposta completa, sem handoff e sem item de trabalho criado, **e com aprovação de um juiz LLM** ([docs](https://support.atlassian.com/customer-service-management/docs/about-customer-service-agent-resolutions/), sem data).

**Zendesk.** No Relate 2026 (19/05/2026), passou a cobrar só as resoluções que **um modelo de avaliação separado confirma** e declarou encerrada a "era da deflexão". Lançou o Knowledge Copilot, que aponta lacunas e conteúdo desatualizado a partir de conversas reais, e o Quality Score, que avalia 100% das interações; os dois estão em early access ([Zendesk](https://www.zendesk.com/in/newsroom/articles/relate-2026/); [diginomica, secundária](https://diginomica.com/zendesk-relate-2026-zendesk-prepares-outcome-based-future-built-verified-resolutions)). A *intelligent triage* classifica tópico, idioma, sentimento e entidades e permite SLA por sentimento ([docs](https://support.zendesk.com/hc/en-us/articles/8726057566746), sem data; o SLA por sentimento é **fonte única**).

**Intercom Fin.** A resolução é *confirmada* quando o cliente diz que ajudou e *presumida* quando ele sai sem pedir mais nada. Não conta se a última mensagem do Fin foi uma pergunta, e é descontada se o cliente volta pedindo ajuda ([help center, 23/09/2026](https://www.intercom.com/help/en/articles/8205718-fin-resolutions)). O **Fin Evals** (beta, 2026) roda conversas simuladas e combina checagens determinísticas, como tool chamada ou handoff, com um juiz de IA guiado por *scorecards* com pesos, critérios críticos e limiar de aprovação ([help center](https://www.intercom.com/help/en/articles/15899411-fin-evals-beta); [comparativo](https://www.intercom.com/help/en/articles/14077180-simulations-vs-batch-tests-vs-previews)). O **CX Score** dá nota de 1 a 5, com motivos, a toda conversa ([blog Intercom](https://www.intercom.com/blog/?p=32209); [comunidade, jul/2025](https://community.intercom.com/support-operations-56/how-intercom-s-cs-team-started-using-our-cx-score-to-improve-support-quality-10990)).

**Freshservice (Freddy).** Desde 13/11/2025 o agente atende no portal e dentro do Microsoft 365 Copilot ([Freshworks](https://www.freshworks.com/theworks/company-news/november-2025-launch/)). O Copilot do analista inclui Ticket Summariser, Reply Suggester, Similar Ticket Suggester e **Help Article Generator** ([docs, 28/07/2026](https://support.freshservice.com/en/support/solutions/articles/50000009429-freddy-ai-copilot-overview)). Não encontrei recurso de sentimento.

**Microsoft Employee Self-Service.** Oferece um starter de TI no Copilot Studio, conector ServiceNow para ler e criar chamados, transferência para o Now Assist ou para uma pessoa, e telemetria de conclusão e satisfação ([Microsoft Learn, 13/10/2026](https://learn.microsoft.com/en-us/microsoft-365/copilot/employee-self-service/overview)).

**Sierra e Decagon** (atendimento ao cliente, mas referência de engenharia). A Sierra gera conversas com personas, que variam idioma, familiaridade com tecnologia e tom, e usa um juiz independente. Cada cenário roda várias vezes e o CI **bloqueia a release como faria um teste unitário** ([Sierra, 19/08/2025](https://sierra.ai/blog/simulations-the-secret-behind-every-great-agent)). A Decagon cria personas a partir de conversas em que o agente falhou e verifica se o procedimento foi seguido, se a resposta veio da base e se o escalonamento funcionou ([Decagon, 2025](https://decagon.ai/blog/decagon-simulations)).

**Aisera.** Propôs o CLASSic, que mede custo, latência, acurácia, estabilidade e segurança ([Aisera, mar/2025](https://aisera.com/press-releases/aisera-introduces-a-framework-to-evaluate-how-domain-specific-agents/)). O CLEAR, de outro autor, acrescenta acurácia normalizada por custo e pass@k, e relata que otimizar só a acurácia sai de 4,4 a 10,8 vezes mais caro ([arXiv 2511.14136, 18/11/2025](https://arxiv.org/abs/2511.14136), **fonte única**).

### 2.2 Avaliação e confiabilidade

- **τ-bench** ([arXiv 2406.12045, jun/2024](https://arxiv.org/abs/2406.12045); [Sierra](https://sierra.ai/blog/benchmarking-ai-agents)) combina usuário simulado, ferramentas e política, e mede com **pass^k** se o agente acerta em todas as k tentativas. O GPT-4o caiu para cerca de 25% em pass^8 no varejo.
- **τ²-bench** ([arXiv 2506.07982, jun/2025](https://arxiv.org/abs/2506.07982)) introduz o controle duplo: o usuário também age, e o desempenho cai quando o agente precisa guiá-lo. No Nexo é o funcionário quem confirma ou altera o rascunho.
- **Anthropic** ([09/01/2026](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)) recomenda graders de código, de modelo e humanos; avaliar o resultado, não a ordem exata das tools; e ler as transcrições. Com 75% de acerto por tentativa, o pass^3 cai para cerca de 42%. Para agentes de conversa: usuário simulado, checagem de estado, limite de turnos e rubrica, começando com 20 a 50 tarefas tiradas de falhas reais.
- **Mastra scorers** ([06/08/2025](https://mastra.ai/blog/mastra-scorers)): o framework do Nexo já traz tool-call-accuracy, faithfulness e hallucination prontos.

### 2.3 Segurança e observabilidade

- **OWASP LLM Top 10 2025** ([genai.owasp.org](https://genai.owasp.org/llm-top-10/); [promptfoo](https://promptfoo.dev/docs/red-team/owasp-llm-top-10/)): de LLM01 Prompt Injection a LLM10 Unbounded Consumption. O LLM06 Excessive Agency trata de funcionalidade, permissão e autonomia em excesso.
- **OWASP Agentic Top 10** ([09/12/2025](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications/); [Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/)): de ASI01 Goal Hijack a ASI10 Rogue Agents, guiado pelo princípio de *menor agência*.
- **Padrões contra injeção** ([arXiv 2506.08837, jun/2025](https://arxiv.org/abs/2506.08837); [Simon Willison](https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/)): action-selector, plan-then-execute, dual LLM e outros. O `step-policy.ts` do Nexo é parente do action-selector, e vale escrever isso no README.
- **OpenTelemetry GenAI** ([repositório](https://github.com/open-telemetry/semantic-conventions-genai), status *Development*): spans `invoke_agent {gen_ai.agent.name}` e `execute_tool`. `gen_ai.conversation.id` não deve receber um UUID inventado, e o conteúdo das mensagens é **opt-in** por conter dados pessoais.

### 2.4 Métricas de valor

- **Resolução, não deflexão.** As definições mudam de fornecedor para fornecedor, então não dá para comparar taxas entre eles.
- **Gartner** ([05/03/2025](https://www.gartner.com/en/newsroom/press-releases/2025-03-05-gartner-predicts-agentic-ai-will-autonomously-resolve-80-percent-of-common-customer-service-issues-without-human-intervention-by-20290); [CX Today](https://cxtoday.com/contact-center/agentic-ai-gartner-predicts-80-of-customer-problems-solved-without-human-help-by-2029)) prevê que, até 2029, 80% dos problemas comuns serão resolvidos sem humano, com 30% menos custo. É uma previsão.
- **Custo por contato humano:** entre US$ 18 e 24 na MetricNet de 2023, contra cerca de US$ 2,37 no autoatendimento em 2021 **(secundária: [MetricNet/BrightTALK](https://www.brighttalk.com/resource/core/447335/benchmarking-roundup---summary-of-2023-service-and-support-benchmarks-v3_954461.pdf))**. Serve só como ordem de grandeza.
- **Qualidade em toda conversa:** é o que o CX Score e o Quality Score fazem, em vez de esperar a pesquisa voluntária.

### 2.5 Como a fronteira faz o que já está em andamento no Nexo

- **Red-team:** mapear cada cenário a uma categoria OWASP (LLM01/02/06/07, ASI01/02/03/09) e incluir **injeção indireta por artigo da central**, já que a busca híbrida vai pôr texto de artigo no contexto. Informar o pass^k com `--repeat`: um ataque que passa uma vez em cinco é uma falha.
- **Busca híbrida:** além de recall@k e MRR, medir quantas vezes o agent acerta ao não citar nenhum artigo. O limiar usado para isso alimenta a R4.
- **SLA proativo:** como no Explain SLA, o aviso deve dizer *por que* o prazo está em risco, com o cálculo em código.
- **Resposta sugerida:** medir quantas sugestões o analista aceitou sem editar, editou ou descartou.
- **Langfuse/OTel:** usar os nomes `gen_ai.*`, o id real da conversa e deixar o conteúdo desligado por padrão.

---

## 3. Tabela de capacidades

O esforço inclui os testes. O valor considera os critérios do PRD: decisões, conversa, transparência, interface, arquitetura e README.

| Capacidade | Quem faz (fontes) | Nexo hoje | Valor | Esforço (h) | Risco |
|---|---|---|---|---|---|
| Triagem automática (intenção, categoria, prioridade) | Zendesk triage; Salesforce; Rovo | Sim (entendimento forçado + matriz em código) | já coberto | 0 | — |
| Resumo para o analista na transferência | ServiceNow; Rovo; Freshservice | Sim (relatório determinístico, sem LLM) | já coberto e diferencial | 0 | — |
| Ação só com confirmação, menor agência | OWASP LLM06/ASI02; arXiv 2506.08837 | Sim (rascunho, confirmação atômica, step-policy) | já coberto | 0 | — |
| Resposta sugerida ao analista | ServiceNow; Rovo; Freshservice | Em andamento | médio | — | sugestão aceita sem leitura |
| Aviso/explicação de risco de SLA | ServiceNow Explain SLA | Em andamento | médio | +1–2 (explicar o porquê) | baixo |
| Busca na central (RAG) | Atlassian; todos | Em andamento | alto | — | injeção indireta |
| **Usuário simulado + pass^k** | τ-bench; τ²-bench; Anthropic; Sierra; Decagon; Intercom; Salesforce | Parcial (falas fixas, `--repeat`) | **alto** | 5–7 | variação e custo |
| **Incidente em massa** | Salesforce; ServiceNow (e-mail de incidente grave) | Não (duplicidade só por funcionário) | **alto** | 4–6 | agrupamento errado; vazamento pela contagem |
| **Resolução confirmada/presumida/reaberta** | Intercom; Zendesk; Atlassian | Parcial (sem humano + "Isso resolveu?") | **alto** | 2–3 | baixo |
| **Lacunas da central** | Atlassian Suggested topics; Zendesk Knowledge Copilot | Não | **alto** | 3–4 | baixo (depende do limiar da busca) |
| **Sinal de frustração** | ServiceNow sentiment; Zendesk triage | Não | **médio-alto** | 3–4 | falso positivo, transferências demais |
| Artigo gerado de chamado resolvido (com revisão) | ServiceNow; Freshservice | Não | médio | 5–8 | alucinação e dados pessoais na central |
| Juiz com rubrica e critérios críticos | Intercom; Salesforce; Anthropic | Parcial (G-Eval no benchmark) | médio | 2–3 (junto da R1) | viés do juiz |
| Qualidade automática em 100% das conversas | Intercom CX Score; Zendesk Quality Score | Não | baixo-médio | 4–6 | custo no plano Hobby |
| Traces no padrão OTel GenAI | OpenTelemetry (Development) | Em andamento (Langfuse) | médio | +2–3 | especificação instável |
| Multilíngue | Intercom (45 idiomas); Zendesk | Não | baixo | 1–2 (só detectar) | artigos e regras em português |
| Voz | Intercom Fin Voice; Sierra | Não | baixo | > 20 | alto |
| Conectores reais de ITSM / MCP | Microsoft + ServiceNow; Zendesk MCP | Não (legado simulado) | baixo | > 10 | credenciais e ataque |

---

## 4. Top 5 recomendações

Custos de referência do projeto: cerca de US$ 0,01 por turno do agent (README; o teto de 1.000 turnos dá cerca de US$ 10,60) e cerca de US$ 0,032 por atendimento com o Gemini 3.5 Flash (benchmark). Como o E2E roda sem LLM, o que depende do modelo vai para os evals e o Playwright cobre telas com dados semeados.

### R1. Evals com funcionário simulado e pass^k (5–7 h)

**Por que impressiona:** é o que fazem τ-bench, Anthropic, Sierra, Decagon e Intercom. Prova que o autor sabe que um teste aprovado uma vez não garante confiabilidade, e responde direto ao "como garantiu a qualidade das decisões". O controle duplo do τ²-bench encaixa no Nexo, porque é o funcionário quem confirma.

**O que fazer:** criar de 6 a 8 personas. Cada uma tem um objetivo oculto, fatos que só conta se perguntarem e um estilo: vaga, impaciente, com erros de digitação ou que muda de ideia. Um LLM barato faz o papel do funcionário, com até 8 turnos, e "clica" Confirmar ou Alterar pelas respostas rápidas. No fim, uma checagem no `eval.db` confere tipo, categoria e prioridade do chamado, ou que nenhum chamado foi criado, ou que houve transferência. Uma rubrica curta verifica se o agent perguntou algo que já tinha sido dito. O resultado mostra pass^1 e pass^3, calculados com o estimador do τ-bench, C(c,k)/C(n,k), e o custo por cenário aprovado.

**Critério de aceite:** `npm run eval:sim -- --k=3` mostra, por persona, pass^1, pass^3, turnos e custo, e termina com código de erro se o pass^3 ficar abaixo do limiar ou se um cenário crítico falhar. Exemplo: a persona "VPN erro 809, Windows 11, reunião com cliente às 15h de hoje, que ela só conta se perguntarem" precisa terminar em INC de Rede e VPN, prioridade Alta, prazo de 4 h úteis, criado só depois de Confirmar e com até 3 perguntas.

**Como validar:** Vitest para o estimador (com n=3 e c=2: pass^1 = 0,67, pass^2 = 0,33 e pass^3 = 0) e para a checagem de estado com banco de fixture. Depois, uma rodada real com o modelo, com o resultado publicado no README. Não precisa de Playwright.

**Custo de LLM:** 24 conversas (8 × 3) somam cerca de 120 turnos, US$ 1,20, mais o simulador (cerca de US$ 0,30 com o Flash Lite) e o juiz (cerca de US$ 0,10). São US$ 1,50 a 2,00 por rodada; antes, conferir se os tetos diários não interrompem a rodada.

### R2. Incidente em massa ("problema conhecido") (4–6 h)

**Por que impressiona:** o PRD define o impacto como *quantas pessoas são afetadas*, mas hoje o modelo deduz o impacto de uma mensagem só. A proposta é calcular, em código, um sinal que junta vários funcionários e entra na matriz de prioridade. É o que a Salesforce anuncia, mostra domínio de ITIL e trata a privacidade com cuidado.

**O que fazer:** criar a função pura `detectKnownIssues(tickets, now)`, que agrupa chamados abertos nas últimas 4 horas úteis pela categoria e por um termo relevante em comum (reaproveitando a tokenização da duplicidade), exigindo pelo menos 3 funcionários diferentes. A tool devolve só `{categoria, relatos, desde}`, sem ids, títulos ou nomes. O rascunho sobe o impacto para "equipe", a matriz recalcula a prioridade e o trace registra a regra `incidente-em-massa`. Se a prioridade virar crítica, a transferência automática que já existe entra em ação. O console mostra um banner do tipo "Possível incidente em massa · Rede e VPN · 4 relatos desde 09:40".

**Critério de aceite:** com 3 chamados de VPN abertos por outras pessoas nas últimas 2 h, a Ana escreve "a VPN caiu agora". O agent responde que é um problema conhecido, sem nomes nem números de chamados alheios, e o rascunho sai com impacto "equipe" e prioridade recalculada. Com só 2 relatos, ou com relatos fora da janela, nada muda.

**Como validar:** Vitest para o limiar, a janela em horas úteis, a contagem de funcionários distintos e a ausência de identificadores na saída. Um eval com `replyExcludes` contendo os nomes e os números dos chamados dos outros. No Playwright, sem LLM: semear 4 chamados e ver o banner no console do Rafael; como Ana, usar "Alterar detalhes" num rascunho semeado e conferir que a prioridade já considera a equipe.

**Custo de LLM:** quase zero (cerca de 50 tokens a mais por tool); o eval sai por cerca de US$ 0,05.

### R3. Métrica de resolução honesta (2–3 h)

**Por que impressiona:** a Zendesk abandonou a deflexão como métrica principal, e Intercom e Atlassian publicam suas definições de resolução. Publicar as próprias regras e descontar o que não é resolução mostra maturidade de produto.

**O que fazer:** em `domain/insights.ts`, separar quatro grupos. **Confirmada:** o funcionário respondeu "sim" ao "Isso resolveu?". **Presumida:** a conversa não teve transferência, analista nem rascunho pendente, e a última mensagem do agent não era uma pergunta. **Abandonada:** a última mensagem do agent foi uma pergunta. **Reaberta:** a pessoa voltou com o mesmo problema em até 7 dias; essa conversa deixa de contar como resolvida. Calcular também o custo por resolução. Um tooltip explica cada definição.

**Critério de aceite:** com 6 conversas na fixture (1 com "sim", 1 silenciosa depois do artigo, 1 terminando em pergunta, 1 transferida, 1 reaberta em 3 dias e 1 com rascunho pendente), o painel mostra 1 confirmada, 1 presumida, 1 abandonada, 1 reaberta, taxa de 33% e custo por resolução igual ao custo total dividido por 2.

**Como validar:** Vitest em `insights.test.ts`. No Playwright (`insights.spec.ts`), com o banco semeado, conferir os quatro números e que o tooltip abre pelo teclado.

**Custo de LLM:** zero.

### R4. Lacunas da central de ajuda (3–4 h)

**Por que impressiona:** é o ciclo de conhecimento que a Atlassian e a Zendesk vendem. O agent passa a mostrar onde a central falha, sem gastar token, usando os traces que o Nexo já grava.

**O que fazer:** é candidato a lacuna o turno em que `searchHelpCenter` voltou vazio ou abaixo do limiar de relevância (o mesmo da busca híbrida) e a conversa terminou em chamado, transferência ou "não resolveu". Agrupar por categoria e termos principais. A seção "Lacunas da central (30 dias)" mostra o tema, quantas buscas ficaram sem artigo, o percentual que virou chamado e uma frase de exemplo com e-mails e números mascarados. Como na Atlassian, só aparecem temas acima de um mínimo de ocorrências.

**Critério de aceite:** 4 buscas por "impressora do 3º andar" sem artigo, 3 delas viradas em chamado, geram a linha "Hardware · impressora, andar · 4 buscas · 75% viraram chamado". "VPN 809", que encontra artigo acima do limiar, não aparece. Um CPF na frase de exemplo aparece mascarado.

**Como validar:** Vitest para a função e o mascaramento. No Playwright, com traces semeados, a seção mostra o tema esperado.

**Custo de LLM:** zero.

### R5. Sinal de frustração no entendimento (3–4 h)

**Por que impressiona:** ServiceNow e Zendesk tratam sentimento como recurso básico. No Nexo ele sai quase de graça, porque o `recordUnderstanding` já é obrigatório em todo turno, e o motivo aparece no painel "por quê?".

**O que fazer:** acrescentar `frustration` (`none`, `some` ou `high`) e `frustrationReason` ao schema. A regra em código: frustração alta, frustração moderada em dois turnos seguidos ou o mesmo problema voltando fazem o agent **oferecer** um analista, sem transferir sozinho, a não ser que o caso também seja crítico ou esteja vencido. No console aparece o chip "Frustração alta", com texto e não só cor, e esses casos vêm primeiro entre os de mesma prioridade. O relatório da conversa mostra o motivo. O funcionário nunca vê o rótulo, e a frustração nunca rebaixa a prioridade.

**Critério de aceite:** a mensagem "minha VPN caiu de novo, é a terceira vez essa semana, isso é um absurdo" gera `high`; o agent continua tentando ajudar e oferece um analista. A mensagem "Qual o horário do service desk?" gera `none` e não leva a nenhuma oferta.

**Como validar:** Vitest da regra, dois cenários de eval e a suíte inteira de novo, porque o schema mudou. No Playwright, uma conversa semeada mostra o chip na fila, aparece na ordem certa e traz o motivo no relatório.

**Custo de LLM:** de 15 a 30 tokens a mais por turno, menos de 2% do custo; a suíte de eval custa cerca de US$ 0,20.

---

## 5. Skills para executar

| Recomendação | Skills |
|---|---|
| R1 | `mudanca-sdd-tdd` (spec e teste do estimador), `ajustar-agent` (rodar e ler os evals) |
| R2 | `mudanca-sdd-tdd`, `ajustar-agent`, `testar-ui-playwright` (banner), `security-specialist` (vazamento entre funcionários), `design:ux-copy` (mensagem "problema conhecido") |
| R3 | `mudanca-sdd-tdd`, `dataviz` (painel), `design:ux-copy` (definições), `testar-ui-playwright` |
| R4 | `mudanca-sdd-tdd`, `dataviz`, `testar-ui-playwright`, `security-specialist` (mascaramento) |
| R5 | `ajustar-agent` (schema sem regressão), `mudanca-sdd-tdd`, `testar-ui-playwright`, `design:ux-copy` (oferta empática), `design:accessibility-review` (chip que não depende de cor) |

A `anthropic-skills:deep-research` só vale se for preciso aprofundar o τ²-bench antes da R1.

---

## 6. O que NÃO fazer

- **Voz:** exige telefonia, aumenta latência e custo, e o PRD pede chat.
- **Ações autônomas sem confirmação** (reset de senha, liberar acesso): contrariam o PRD e o OWASP LLM06/ASI02–03. A confirmação explícita é um ponto forte do Nexo.
- **Integração real com ServiceNow, Jira ou MCP:** traz credenciais, OAuth e mais superfície de ataque sem ganho de nota. O legado simulado já demonstra a resiliência.
- **Multiagente:** mais latência, mais custo e os riscos ASI07/ASI08. Um agent com políticas em código é mais fácil de auditar.
- **Juiz em 100% das conversas em produção:** praticamente dobra o custo por turno com o teto de US$ 10. Melhor fazer isso offline.
- **Publicar artigo gerado sem revisão:** risco de alucinação e de vazar dados pessoais. Só como rascunho para o analista.
- **Previsão de SLA com machine learning:** sem histórico real, não se sustenta. A regra com explicação é mais honesta.
- **Multilíngue completo:** artigos, regras e avaliação estão em português.
- **Usar taxas de fornecedores ou do leaderboard como meta:** as definições não são comparáveis. O certo é publicar as próprias (R3).
- **Sentimento que transfere sozinho ou rebaixa prioridade:** gera viés e excesso de transferências.
- **Trocar o modelo perto da entrega:** o README já explica por que manter o Gemini.
