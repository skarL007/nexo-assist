# Console em tempo real: stream (SSE) × polling

**Pergunta:** quando alguém escreve numa conversa, o stream faz a mensagem aparecer na tela mais rápido do que o polling que já existia? E, se o stream cair, a tela continua funcionando?

**Resposta:** sim, nas duas perguntas. Com o stream, a mensagem aparece no console em **~0,3–0,4 s** de mediana. Com o polling, a mediana é de **~1,5–1,7 s**, e o p95 de 2,5–2,7 s. No pior caso medido, o stream ficou abaixo de 1 s. Quando o stream é derrubado de propósito, o console volta ao polling sozinho e continua recebendo as mensagens.

## Como funciona

A Vercel não tem fila de eventos compartilhada entre as funções. Por isso o servidor não "empurra" o evento do banco. Ele confere uma **assinatura barata** do estado a cada 1 s e avisa a tela só quando ela muda:

- **Assinatura:** uma consulta só de agregados, com `max` e `count` sobre colunas indexadas. Está em [`change-feed.ts`](../../src/infrastructure/repositories/change-feed.ts).
  - **Console:** conversas, mensagens, chamados, rascunhos pendentes e avaliações.
  - **Funcionário:** a conversa dele e as mensagens dela.
- **Vigia:** [`change-watcher.ts`](../../src/application/change-watcher.ts) emite `change` quando a assinatura muda.
  - Manda um `ping` a cada 15 s para proxies não derrubarem a conexão parada.
  - Termina em 50 s, abaixo do limite de 60 s da função; o navegador reconecta em 1 s (`retry: 1000`).
  - Também termina se o banco falhar ou se o cliente sair.
- **Tela:** [`use-live-updates.ts`](../../src/lib/use-live-updates.ts).
  - Um `change` invalida o cache do RTK Query no console ou busca `/api/chat` no chat. Os dados continuam vindo pelas rotas de sempre, com as mesmas permissões.
  - Com o stream aberto, o polling passa para 30 s (rede de segurança).
  - Se o stream não volta em 3 s, ou se o servidor o recusa, a tela volta ao polling de antes (4 s na lista, 3 s na conversa) e mostra "Atualiza a cada 4 s".
  - **Aba escondida** fecha o stream. Ao voltar, a tela reabre o stream e atualiza.
  - **Reconexão:** depois de cada reconexão a tela busca de novo, porque a mudança feita durante a reconexão não gera evento.
- **Rotas:** `GET /api/console/stream` exige analista. `GET /api/chat/stream` exige funcionário e só vê a conversa da própria pessoa; a identidade vem da sessão.

## Como medi

[`e2e/live.spec.ts`](../../e2e/live.spec.ts) roda no Playwright contra o build de produção, sem LLM:

1. Um segundo contexto do navegador, que é outra sessão do analista, assume a conversa da Elisa e escreve nela pela API.
2. O console aberto em outro contexto espera o texto aparecer. A tela é conferida a cada 25 ms.
3. O tempo vai da gravação confirmada pelo servidor até o texto visível.
4. São 8 mensagens por modo, com espera aleatória de 0,3 a 1,5 s entre elas, para não sincronizar com o ciclo do polling.
5. O mesmo console roda com o stream e com `?ao-vivo=0`, que força o polling antigo.

O teste **falha** em dois casos: se o p95 com o stream passar de 2 s, ou se a mediana com o stream não for menor que a do polling. Assim, a afirmação vira um critério verificável, executado a cada `npm run test:e2e`.

## Resultados (28/10/2026, build de produção local, SQLite)

| Execução | Modo | Mediana | p95 | Máximo |
|---|---|---|---|---|
| 1 (só o arquivo) | **Stream** | **263 ms** | **966 ms** | 966 ms |
| 1 | Polling | 1505 ms | 2712 ms | 2712 ms |
| 2 (suíte inteira, 31/31) | **Stream** | **447 ms** | **806 ms** | 806 ms |
| 2 | Polling | 1684 ms | 2530 ms | 2530 ms |

Os mesmos testes conferem mais duas coisas:

- **Funcionária:** a resposta do analista apareceu no chat da Elisa em 459 ms e em 432 ms. Antes, o chat buscava a cada 4 s, uma média esperada de ~2 s.
- **Stream derrubado:** o teste devolve 503 em `/api/console/stream`. O indicador muda para "Atualiza a cada 4 s" e a mensagem chega mesmo assim, pelo polling.

Os testes de unidade cobrem o resto:

- [`change-watcher.test.ts`](../../src/application/change-watcher.test.ts) usa relógio falso para conferir que a primeira leitura é a base, que só há aviso quando algo muda, o ping, o fim em `maxMs`, a falha do banco e a saída do cliente.
- [`sse.test.ts`](../../src/server/sse.test.ts) confere o formato `text/event-stream`.
- [`repositories.test.ts`](../../src/infrastructure/repositories/repositories.test.ts) usa SQLite de verdade. A assinatura muda com uma mensagem gravada no mesmo milissegundo, porque o `count` pega o que o `max` não pega. A conversa de outra pessoa não muda a assinatura da Elisa.

## Limites (dito com franqueza)

- **Não é push de verdade.** É uma conferência no servidor a cada 1 s. A latência mínima fica em torno de 0 a 1 s mais o tempo de buscar os dados. Para push real seria preciso uma fila compartilhada, como Redis pub/sub, ou um serviço de realtime. Com 1 s de intervalo, o ganho que faltaria seria pequeno.
- **Custo:** cada aba aberta faz uma consulta de agregados por segundo no Turso, e a função fica aberta até 50 s por conexão. No plano com Fluid Compute, a espera sem CPU custa pouco. Mesmo assim, com muitos analistas o certo seria a fila compartilhada. A aba escondida não segura conexão.
- **Medição local:** o banco é SQLite no mesmo disco. Em produção, o Turso adiciona dezenas de ms por consulta, tanto no stream quanto no polling.
