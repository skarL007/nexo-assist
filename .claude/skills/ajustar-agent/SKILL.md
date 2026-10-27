---
name: ajustar-agent
description: Como alterar o comportamento do agent Nexo Assist (instruções, tools, guardrails) sem regredir decisões. Use quando pedirem para o agent fazer algo novo, responder diferente ou corrigir uma decisão errada.
---

# Ajustar o agent

1. **Reproduza** a decisão errada como cenário em `evals/scenarios.ts` (conversa + expectativa de intenção/ferramentas).
2. **Escolha onde corrigir**, nesta ordem de preferência:
   - É uma regra do service desk? Coloque no **código** (domínio ou tool), não no prompt. Ex.: prioridade, prazo, privacidade, confirmação.
   - Falta uma capacidade? Crie uma **tool** em `src/agent/tools/`, registre em `index.ts`, chame `turn.recorder.step(...)` para o passo aparecer no trace.
   - É estilo de conversa (tom, ordem das perguntas)? Ajuste `src/agent/instructions.ts`.
3. **Rode `npm run eval`** (precisa de `GOOGLE_GENERATIVE_AI_API_KEY`). Todos os cenários devem continuar passando.
4. Confira no navegador que o "por quê?" da resposta mostra a decisão e os passos novos.

Garantias que não podem quebrar: passo 0 forçado (`recordUnderstanding`), confiança < 50% transfere, `confirmDraft` só para rascunho de turno anterior, funcionário vem da sessão (nunca de argumento da tool).
