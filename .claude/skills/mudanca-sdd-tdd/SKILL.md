---
name: mudanca-sdd-tdd
description: Fluxo obrigatório para qualquer mudança de comportamento no Nexo Assist (regra do service desk, tela, rota ou agent). Use quando pedirem para adicionar, alterar ou corrigir uma funcionalidade. Começa pela spec, depois teste que falha, depois código, depois verificação.
---

# Mudança com SDD + TDD

1. **Spec primeiro.** Abra o arquivo certo em `docs/specs/` e descreva o comportamento novo em 2–5 linhas, com um critério de aceite verificável (entrada → resultado). Se nenhum arquivo cobrir o assunto, crie `docs/specs/NN-assunto.md` e adicione ao índice.
2. **Teste que falha.**
   - Regra pura → `src/domain/*.test.ts`.
   - Caso de uso → `src/application/*.test.ts` com os dublês de `test-doubles.ts`.
   - Fluxo de tela → `e2e/*.spec.ts` (Playwright).
   - Decisão do agent → novo cenário em `evals/scenarios.ts`.
   Rode `npm test` e confirme que o teste novo **falha pelo motivo certo**.
3. **Código mínimo** na camada certa (tabela "Onde mexer para…" em `docs/specs/04-arquitetura.md`). Domínio não importa framework; rotas ficam finas.
4. **Verificação:** `npm run typecheck && npm run lint && npm test`. Se mexeu em tela: `npm run test:e2e`. Se mexeu no agent: `npm run eval`.
5. **Commit pequeno**, mensagem em português no formato `tipo(escopo): o quê`, explicando o porquê no corpo.

Nunca pule o passo 2 para "ganhar tempo": o teste é o que prova a mudança na entrevista.
