# Benchmark de modelos — tabelas (gerado)

> Gerado por `npm run benchmark -- --report` em 2026-10-27 20:26 UTC a partir de `evals/benchmark/results/`. Não edite à mão: a análise está em [RELATORIO.md](RELATORIO.md).

## Ranking — score composto (pesos 40/30/15/15)

| # | Modelo | Composto | Composto sem cache | Efetividade | Qualidade (1–5) [IC 95%] | Latência p50 | Custo/atendimento | Pareto |
|---|---|---|---|---|---|---|---|---|
| 1 | **GPT-6 Luna** | 0,867 | 0,844 (1º) | 88% | 4,73 [4,64–4,80] | 5,7 s | US$ 0,0012 | ✓ |
| 2 | **Gemini 3.5 Flash Lite** | 0,841 | 0,841 (2º) | 96% | 4,67 [4,58–4,75] | 5,5 s | US$ 0,0072 |  |
| 3 | **DeepSeek V4.1 Flash** | 0,795 | 0,782 (3º) | 88% | 4,69 [4,58–4,79] | 7,3 s | US$ 0,0049 |  |
| 4 | **Mistral Small 4** | 0,787 | 0,755 (4º) | 75% | 4,44 [4,26–4,59] | 6,2 s | US$ 0,0013 |  |
| 5 | **Gemini 3.5 Flash (produção)** | 0,725 | 0,725 (5º) | 83% | 4,72 [4,61–4,81] | 6,9 s | US$ 0,0319 |  |
| 6 | **Qwen3.8 Flash (sem raciocínio)** | 0,686 | 0,639 (7º) | 67% | 4,65 [4,49–4,79] | 15,5 s | US$ 0,0011 | ✓ |
| 7 | **Gemini 3.8 Flash** | 0,649 | 0,649 (6º) | 75% | 4,84 [4,79–4,88] | 12,2 s | US$ 0,0151 | ✓ |

- **Qwen3.8 Flash**: desqualificado — pré-voo: tool_choice forçado falhou (Provider returned error)

## Efetividade — checagens determinísticas

| Modelo | Conversas ok [IC 95%] | Conversas | 1º passo = recordUnderstanding | Tool pedida e não executada | Turnos com erro | Retentativas por 429 |
|---|---|---|---|---|---|---|
| Gemini 3.5 Flash (produção) | 83% [67%–96%] | 24 | 100% | 0% | 0% | 0 |
| Gemini 3.8 Flash | 75% [58%–92%] | 24 | 100% | 0% | 18% | 0 |
| Gemini 3.5 Flash Lite | 96% [88%–100%] | 24 | 100% | 0% | 0% | 0 |
| GPT-6 Luna | 88% [75%–100%] | 24 | 100% | 0% | 0% | 0 |
| DeepSeek V4.1 Flash | 88% [75%–100%] | 24 | 100% | 0% | 0% | 0 |
| Mistral Small 4 | 75% [58%–92%] | 24 | 100% | 0% | 7% | 10 |
| Qwen3.8 Flash | — | 0 | — | — | — | 0 |
| Qwen3.8 Flash (sem raciocínio) | 67% [46%–83%] | 24 | 100% | 0% | 18% | 2 |

Aprovações por cenário (aprovadas / repetições):

| Cenário | Gemini 3.5 Flash (produção) | Gemini 3.8 Flash | Gemini 3.5 Flash Lite | GPT-6 Luna | DeepSeek V4.1 Flash | Mistral Small 4 | Qwen3.8 Flash (sem raciocínio) |
|---|---|---|---|---|---|---|---|
| Dúvida respondida pela central | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 |
| Artigo não vale para o caso (VPN 809 no Windows 11) | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 |
| Consulta sem número com vários chamados abertos | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 |
| Chamado vencido | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 |
| Privacidade: chamado de outra pessoa | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| Fora do escopo de TI | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 0/2 | 2/2 |
| Pedido explícito de analista | 2/2 | 2/2 | 2/2 | 2/2 | 0/2 | 1/2 | 1/2 |
| Complementar chamado existente | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| Problema parecido com chamado aberto (duplicidade) | 2/2 | 0/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| Abrir chamado conversando (pergunta o que falta e monta rascunho) | 0/2 | 2/2 | 2/2 | 1/2 | 2/2 | 1/2 | 1/2 |
| PRD · Reabrir chamado resolvido há até 7 dias | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| PRD · Confirmar o rascunho por texto | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| PRD · Caso crítico para a empresa toda | 0/1 | 1/1 | 1/1 | 0/1 | 1/1 | 0/1 | 0/1 |
| PRD · Mensagem vaga não vira ação | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## Qualidade — G-Eval, média do painel (1–5)

| Modelo | Qualidade da decisão | Regras do service desk | Condução da conversa | Clareza da resposta | Transparência do raciocínio | Tom e empatia | Português do Brasil | Geral | só Kimi K3 | só GLM-5.3 |
|---|---|---|---|---|---|---|---|---|---|---|
| Gemini 3.5 Flash (produção) | 4,85 | 4,87 | 4,68 | 4,46 | 4,66 | 4,50 | 4,98 | **4,72** | 4,64 | 4,79 |
| Gemini 3.8 Flash | 4,97 | 4,99 | 4,89 | 4,72 | 4,85 | 4,47 | 4,96 | **4,84** | 4,78 | 4,89 |
| Gemini 3.5 Flash Lite | 4,79 | 4,87 | 4,65 | 4,62 | 4,68 | 4,11 | 4,96 | **4,67** | 4,61 | 4,73 |
| GPT-6 Luna | 4,81 | 4,85 | 4,70 | 4,86 | 4,73 | 4,14 | 5,00 | **4,73** | 4,68 | 4,77 |
| DeepSeek V4.1 Flash | 4,84 | 4,91 | 4,69 | 4,34 | 4,76 | 4,31 | 4,96 | **4,69** | 4,63 | 4,75 |
| Mistral Small 4 | 4,58 | 4,51 | 4,36 | 4,15 | 4,51 | 4,06 | 4,95 | **4,44** | 4,32 | 4,56 |
| Qwen3.8 Flash (sem raciocínio) | 4,84 | 4,81 | 4,56 | 4,30 | 4,80 | 4,32 | 4,92 | **4,65** | 4,57 | 4,73 |

Rastreabilidade dos critérios:

| Critério | De onde vem no PRD | Regras / specs do projeto |
|---|---|---|
| **Qualidade da decisão** (`decisao`) | Como vamos avaliar: Qualidade das decisões · Sucesso: resolução sem fila, encaminhamento certo | specs/02-agent (linha de ação por intenção) · instructions.ts |
| **Regras do service desk** (`regras`) | Anexo A (abertura, duplicidade, transferência, privacidade, escopo, prioridade) · Segurança e privacidade | specs/01-regras-do-service-desk · specs/03 (motivos de transferência) |
| **Condução da conversa** (`conducao`) | Como vamos avaliar: Condução da conversa · História 4 (conferir os dados antes de criar) | instructions.ts (uma pergunta por vez, offerQuickReplies) · specs/02 |
| **Clareza da resposta** (`clareza`) | Como vamos avaliar: Condução da conversa (responde de forma clara) · Eficiência | instructions.ts (no máximo 3 frases, não repetir o card) · model-history.ts (notas ⟦sistema⟧) |
| **Transparência do raciocínio** (`transparencia`) | Como vamos avaliar: Transparência · Visibilidade das decisões ('a parte mais importante do desafio') | tools/understanding.ts (confiança < 0,5 transfere) · specs/02 (trace) |
| **Tom e empatia** (`tom`) | Contexto: agent de atendimento que substitui o formulário | instructions.ts (frases curtas, cordiais e sem jargão) |
| **Português do Brasil** (`idioma`) | Contexto: funcionários da Nexo (empresa brasileira) conversando no chat | instructions.ts (fale em português do Brasil) |

## Latência e tokens por turno

| Modelo | p50 | p95 | 1ª palavra (p50) | Chamadas ao modelo | Tokens de entrada | Tokens de saída | Tokens de raciocínio |
|---|---|---|---|---|---|---|---|
| Gemini 3.5 Flash (produção) | 6,9 s | 11,1 s | 6,6 s | 3,3 | 5.987 | 185 | 0 |
| Gemini 3.8 Flash | 12,2 s | 22,8 s | 11,9 s | 3,3 | 5.743 | 193 | 0 |
| Gemini 3.5 Flash Lite | 5,5 s | 9,7 s | 5,3 s | 3,6 | 6.578 | 176 | 0 |
| GPT-6 Luna | 5,7 s | 9,4 s | 5,4 s | 3,4 | 7.348 | 185 | 20 |
| DeepSeek V4.1 Flash | 7,3 s | 21,9 s | 6,2 s | 3,5 | 12.247 | 632 | 406 |
| Mistral Small 4 | 6,2 s | 18,9 s | 5,8 s | 3,5 | 6.311 | 269 | 103 |
| Qwen3.8 Flash (sem raciocínio) | 15,5 s | 27,4 s | 13,2 s | 3,3 | 10.031 | 219 | 0 |

## Custo real e projeção mensal

Premissas: 3 turnos por atendimento; 0,4 atendimento por funcionário por mês (cenário alto: 1,0).

| Modelo | Gasto no benchmark | Por turno | Por atendimento | Por 1.000 atendimentos | 500 func./mês | 2.000 func./mês | 10.000 func./mês |
|---|---|---|---|---|---|---|---|
| Gemini 3.5 Flash (produção) | US$ 0,298 | US$ 0,0106 | US$ 0,0319 | US$ 31,93 | US$ 6,39 (alto US$ 15,97) | US$ 25,55 (alto US$ 63,87) | US$ 127,73 (alto US$ 319,33) |
| Gemini 3.8 Flash | US$ 0,141 | US$ 0,0050 | US$ 0,0151 | US$ 15,09 | US$ 3,02 (alto US$ 7,54) | US$ 12,07 (alto US$ 30,18) | US$ 60,35 (alto US$ 150,88) |
| Gemini 3.5 Flash Lite | US$ 0,068 | US$ 0,0024 | US$ 0,0072 | US$ 7,24 | US$ 1,45 (alto US$ 3,62) | US$ 5,79 (alto US$ 14,47) | US$ 28,95 (alto US$ 72,37) |
| GPT-6 Luna | US$ 0,011 | US$ 0,0004 | US$ 0,0012 | US$ 1,22 | US$ 0,24 (alto US$ 0,61) | US$ 0,98 (alto US$ 2,44) | US$ 4,89 (alto US$ 12,22) |
| DeepSeek V4.1 Flash | US$ 0,046 | US$ 0,0016 | US$ 0,0049 | US$ 4,94 | US$ 0,99 (alto US$ 2,47) | US$ 3,95 (alto US$ 9,88) | US$ 19,75 (alto US$ 49,38) |
| Mistral Small 4 | US$ 0,012 | US$ 0,0004 | US$ 0,0013 | US$ 1,31 | US$ 0,26 (alto US$ 0,66) | US$ 1,05 (alto US$ 2,62) | US$ 5,25 (alto US$ 13,12) |
| Qwen3.8 Flash (sem raciocínio) | US$ 0,011 | US$ 0,0004 | US$ 0,0011 | US$ 1,13 | US$ 0,23 (alto US$ 0,57) | US$ 0,91 (alto US$ 2,27) | US$ 4,54 (alto US$ 11,34) |

Referência humana: US$ 15,56 por chamado no nível 1 (MetricNet/HDI) → 500 func.: US$ 3.112/mês · 2.000 func.: US$ 12.448/mês · 10.000 func.: US$ 62.240/mês.

## Engenharia de cache

| Modelo | Acerto de cache | Economia do cache | Custo pago | Sem cache (contrafactual) | Por 1.000 atend. com cache | Sem cache | Chamada sem cache (p50) | Com cache (p50) |
|---|---|---|---|---|---|---|---|---|
| Gemini 3.5 Flash (produção) | 0% | US$ 0,0000 | US$ 0,2980 | US$ 0,2980 | US$ 31,93 | US$ 31,93 | 2,2 s (93) | — (0) |
| Gemini 3.8 Flash | 0% | US$ 0,0000 | US$ 0,1408 | US$ 0,1408 | US$ 15,09 | US$ 15,09 | 3,4 s (93) | — (0) |
| Gemini 3.5 Flash Lite | 0% | US$ 0,0000 | US$ 0,0675 | US$ 0,0675 | US$ 7,24 | US$ 7,24 | 1,7 s (100) | — (0) |
| GPT-6 Luna | 71% | US$ 0,0118 | US$ 0,0114 | US$ 0,0232 | US$ 1,22 | US$ 2,48 | 1,7 s (25) | 1,5 s (69) |
| DeepSeek V4.1 Flash | 48% | US$ 0,0225 | US$ 0,0461 | US$ 0,0686 | US$ 4,94 | US$ 7,34 | 1,9 s (41) | 1,6 s (56) |
| Mistral Small 4 | 85% | US$ 0,0202 | US$ 0,0122 | US$ 0,0325 | US$ 1,31 | US$ 3,48 | 2,0 s (6) | 1,8 s (67) |
| Qwen3.8 Flash (sem raciocínio) | 91% | US$ 0,0342 | US$ 0,0106 | US$ 0,0447 | US$ 1,13 | US$ 4,79 | 11,5 s (6) | 3,0 s (86) |

Juízes: GLM-5.3 — 88% do prompt do cache, US$ 0,0011 economizados · Kimi K3 — 82% do prompt do cache, US$ 0,0058 economizados. Cache local de respostas: US$ 0,0059 economizados em reexecuções.

Gasto total medido por chamada: candidatos US$ 0,587 + juízes US$ 0,659; o cache do provedor evitou US$ 0,096.

## Sensibilidade aos pesos

| Perfil | Pesos (efet./qual./lat./custo) | 1º | 2º | 3º |
|---|---|---|---|---|
| Equilibrado | 40/30/15/15 | GPT-6 Luna | Gemini 3.5 Flash Lite | DeepSeek V4.1 Flash |
| Qualidade primeiro | 35/45/10/10 | GPT-6 Luna | Gemini 3.5 Flash Lite | DeepSeek V4.1 Flash |
| Custo primeiro | 35/20/10/35 | GPT-6 Luna | Mistral Small 4 | Gemini 3.5 Flash Lite |
| Latência primeiro | 35/20/35/10 | GPT-6 Luna | Gemini 3.5 Flash Lite | Mistral Small 4 |

Com 10 mil vetores de pesos sorteados (Dirichlet uniforme), quem fica em 1º:

| Modelo | Vezes em 1º |
|---|---|
| GPT-6 Luna | 81% |
| Gemini 3.5 Flash Lite | 19% |
| Qwen3.8 Flash (sem raciocínio) | 0% |
| Gemini 3.8 Flash | 0% |
| Gemini 3.5 Flash (produção) | 0% |
| DeepSeek V4.1 Flash | 0% |
| Mistral Small 4 | 0% |

## Juízes

Calibração com três conversas de qualidade conhecida (média dos critérios):

| Juiz | Método | excelente | mediana | ruim | Ordem certa? |
|---|---|---|---|---|---|
| Kimi K3 | logprobs (média ponderada) | 4,70 | 2,51 | 1,13 | ✓ |
| GLM-5.3 | amostragem (n=2) | 4,93 | 3,00 | 1,36 | ✓ |

Concordância entre Kimi K3 e GLM-5.3 nas 152 conversas: Spearman 0,68, diferença média absoluta 0,20 ponto (médias 4,60 e 4,75).

## Pré-voo — tool_choice forçado

| Configuração | Raciocínio | Passou? | Provedor | Detalhe |
|---|---|---|---|---|
| Gemini 3.5 Flash (produção) | minimal | ✓ | Google | chamou recordUnderstanding |
| Gemini 3.8 Flash | minimal | ✓ | Google | chamou recordUnderstanding |
| Gemini 3.5 Flash Lite | minimal | ✓ | Google | chamou recordUnderstanding |
| GPT-6 Luna | minimal | ✓ | OpenAI | chamou recordUnderstanding |
| DeepSeek V4.1 Flash | minimal | ✓ | Sail Research | chamou recordUnderstanding |
| Mistral Small 4 | minimal | ✓ | Mistral | chamou recordUnderstanding |
| Qwen3.8 Flash | minimal | ✗ | — | Provider returned error |
| Qwen3.8 Flash (sem raciocínio) | none | ✓ | Alibaba | chamou recordUnderstanding |

## Provedores que atenderam (chamadas)

| Modelo | Provedores |
|---|---|
| Gemini 3.5 Flash (produção) | Google (93) |
| Gemini 3.8 Flash | Google (90), Google AI Studio (3) |
| Gemini 3.5 Flash Lite | Google (100) |
| GPT-6 Luna | OpenAI (94) |
| DeepSeek V4.1 Flash | Wafer (22), Fireworks (12), OpenInference (7), Together (7), Baidu (7), CoreWeave (7), InferenceNet (7), ModelRun (6), Sail Research (6), DigitalOcean (5), Relace (4), Cohere (4), BaseTen (2), Decart (1) |
| Mistral Small 4 | Mistral (73) |
| Qwen3.8 Flash (sem raciocínio) | Alibaba (92) |

## Gasto por execução (medido pela chave do OpenRouter)

| Início | Gasto pela chave | Somado por chamada | Cache de respostas | Crédito restante |
|---|---|---|---|---|
| 2026-10-27 20:02 | US$ 1,2669 | US$ 1,2999 | US$ 0,0029 | US$ 0,2375 |
