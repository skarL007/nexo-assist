# Como rodar o benchmark de modelos

`npm run benchmark` roda o agent de produção (`runAgentTurn`) com 7 modelos via OpenRouter: os cenários do eval, duas vezes, mais 4 cenários tirados do PRD. Mede efetividade (as mesmas checagens do eval), qualidade (G-Eval com 7 critérios derivados do PRD e painel de 2 juízes de famílias que não concorrem), latência e custo real cobrado, e combina tudo num score com pesos 40/30/15/15. O resultado está em [`RELATORIO.md`](RELATORIO.md).

```bash
npm run benchmark -- --dry-run   # estima custo e confere o crédito da chave, sem gastar nada
npm run benchmark                # roda o que falta (precisa de OPENROUTER_API_KEY)
npm run benchmark -- --report    # regera relatório e gráficos a partir dos resultados gravados, sem chamar API
```

O estudo gastou US$ 1,80 dos US$ 2,00 de uma chave criada só para ele.

## Engenharia de cache

O briefing do turno traz a hora cheia, em vez dos minutos, e cada conversa vai ao OpenRouter com `session_id`. Assim o prefixo do prompt fica estável e as chamadas da conversa caem no mesmo provedor. Luna, Mistral e Qwen leem de 71% a 91% do prompt do cache, e o Luna paga US$ 1,22 em vez de US$ 2,48 por 1.000 atendimentos. Nos juízes, a parte fixa do prompt vem primeiro e a conversa por último, e um cache local por hash do pedido faz com que rodar de novo não custe nada. Pelo OpenRouter, os Gemini não fizeram cache (0%).

## O que o benchmark achou no prompt (já corrigido)

- **Reabrir chamado resolvido** (0 de 7 modelos passavam): a consulta de chamados passou a devolver também os resolvidos há até 7 dias, e o cenário entrou no `npm run eval`.
- **Agir em caso crítico para a empresa toda** (4 de 7 modelos não agiam): as instruções proíbem perguntar o que a mensagem já respondeu, e um caso crítico vai direto ao rascunho. Com o GPT-6 Luna, que falhava, foi de 0/3 para 3/3.
