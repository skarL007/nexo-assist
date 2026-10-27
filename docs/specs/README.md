# Especificações (SDD)

Este projeto segue *Spec-Driven Development*: cada parte começa por uma especificação curta com o comportamento esperado e os critérios de aceite. Os testes vêm da spec, e o código vem dos testes.

Fluxo para qualquer mudança:

1. **Spec:** descreva o comportamento novo (ou ajuste o existente) num destes arquivos.
2. **Teste:** escreva o teste que falha (`*.test.ts` ao lado do código, ou um cenário em `evals/` quando for decisão do agent).
3. **Código:** implemente o mínimo para o teste passar, na camada certa (veja [04-arquitetura](04-arquitetura.md)).
4. **Verificação:** `npm test`, `npm run typecheck`, `npm run lint`, e `npm run eval` se mexeu no agent.

| Spec | Assunto |
|---|---|
| [01-regras-do-service-desk](01-regras-do-service-desk.md) | Tipos, categorias, prioridade, prazos, duplicidade, reabertura, privacidade |
| [02-agent](02-agent.md) | Como o agent decide, as tools, o trace e as garantias |
| [03-conversa-e-console](03-conversa-e-console.md) | Estados da conversa, transferência, console do analista, API |
| [04-arquitetura](04-arquitetura.md) | Camadas, dependências e onde cada coisa mora |
