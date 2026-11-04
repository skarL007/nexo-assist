# Como o Nexo Assist escala

Este documento descreve o que o Nexo Assist aguenta hoje, onde ele trava primeiro quando o uso cresce e o que mudar em cada degrau. Os números de carga por turno vêm das gravações de 02/11/2026 (`deepinfra/deepseek-ai/DeepSeek-V4-Flash`); as estimativas de volume são hipóteses marcadas como tal.

## O que existe hoje

| Peça | Como está | Limite que importa |
|---|---|---|
| App | Next.js 16 em funções da Vercel; chat por stream NDJSON | 60 s por função (`maxDuration`); o turno precisa caber nisso |
| Banco | Turso (libSQL) num banco só, com Drizzle | Escritas concentradas num primário; linhas quentes nos contadores |
| Tempo real | SSE que confere uma assinatura barata do banco a cada 1 s e avisa a tela quando muda ([TEMPO-REAL](validacao/TEMPO-REAL.md)) | 1 consulta por segundo por tela aberta |
| Modelo | DeepSeek-V4-Flash pela DeepInfra, até 6 passos e 800 tokens de saída por passo | Limite de requisições do provedor; latência de 7 a 30 s por turno |
| Busca | Híbrida (Qwen3-Embedding-8B + palavras) com avaliador de relevância; vetores dos artigos em cache no banco | Cosseno calculado em memória sobre todos os artigos |
| Imagem | Modelo de visão (Mistral-Small-3.1) descreve; os bytes ficam no banco (`message_screenshots`) | Até 1 MB por imagem dentro do banco |
| Custo | Livro-caixa em micro-dólares com teto por dia e total; tetos de turnos; limites por pessoa | Contadores globais numa linha por dia |

## Carga medida por turno

Na conversa gravada (foto do monitor, quatro turnos até resolver; depois o chamado do ponto):

- **Entrada do modelo:** de 9.800 a 10.700 tokens por turno comum; de 16.700 a 19.600 no turno que lê a central ou monta o rascunho (dois passos ou mais). O histórico e as instruções dominam a entrada.
- **Saída do modelo:** de 170 a 610 tokens por turno.
- **Latência:** de 7 a 31 s por turno. A leitura da imagem leva de 3,5 a 8,7 s e acontece antes do modelo.
- **Chamadas por turno:** 1 a 3 passos do agente, 1 embedding da pergunta (os artigos já estão em cache), 1 avaliador de relevância quando há candidatos e, com imagem, 1 leitura de visão.

## Onde trava primeiro, por degrau

As faixas abaixo usam uma hipótese de volume: cada funcionário abre em média 1 conversa por mês, com 4 turnos, e 10% dos funcionários ficam com o chat aberto no horário de pico. Ajuste com o volume real da operação.

### Até 500 funcionários: como está

- Pico estimado: 50 telas abertas, ou seja, 50 consultas de assinatura por segundo, e poucos turnos simultâneos.
- O desenho atual atende. Os tetos de custo e os limites por pessoa já existem.
- Ação: nenhuma mudança de arquitetura. Ligar alertas sobre o livro-caixa e sobre o p95 de latência do turno.

### De 500 a 5.000 funcionários: tirar o polling do banco e as imagens do banco

1. **Tempo real por eventos, não por consulta.** Com 500 telas abertas, o SSE faz 500 consultas por segundo só para descobrir que nada mudou. Trocar a assinatura por publicação de eventos: quem grava a mensagem publica no canal da conversa (Redis pub/sub gerenciado, ou um serviço como Ably ou Pusher), e o SSE só repassa. O contrato com a tela não muda (o evento continua sendo "mudou"), então `use-live-updates.ts` fica igual.
2. **Imagens fora do banco.** Mover os bytes de `message_screenshots` para armazenamento de objetos (Vercel Blob ou S3), guardando no banco só a chave. A rota `/api/chat/screenshots/:id` continua conferindo quem pode ver e passa a devolver um link assinado de curta duração. O banco deixa de crescer 300 KB a 1 MB por imagem.
3. **Cache de prompt do modelo.** As instruções e o começo do histórico se repetem a cada turno. A DeepInfra cobra a entrada em cache do DeepSeek-V4-Flash a 20% do preço. Ordenar o prompt com a parte fixa primeiro aproveita isso; como a entrada é mais de 90% do custo de um turno, a economia esperada fica perto de 50% a 70% do gasto do agente (a confirmar com medição antes e depois).
4. **Contadores sem linha quente.** Os tetos de turnos e o livro-caixa somam numa linha por dia. Com muitos turnos simultâneos, dividir em fatias (por exemplo, `usd_micros:AAAA-MM-DD:<0-15>`) e somar na leitura, mantendo a conferência antes da chamada.

### De 5.000 a 50.000 funcionários: fila, réplicas e vários clientes

1. **Turno fora da requisição.** O turno passa a rodar num worker com fila (Vercel Queues, ou um worker dedicado), e a tela recebe os eventos pelo mesmo canal de tempo real. Isso tira o turno do limite de 60 s da função e permite repetir com segurança quando o provedor falha.
2. **Integração com o sistema de chamados real por outbox.** Hoje o legado é simulado e chamado na hora, com nova tentativa. Com um legado real, gravar a intenção (criar ou complementar o chamado) numa tabela de saída na mesma transação e entregar por um worker idempotente. O rascunho continua só virando chamado depois da confirmação.
3. **Banco por cliente ou réplicas de leitura.** O Turso permite um banco por cliente (isolamento forte, migrações em lote) e réplicas de leitura perto da função. O padrão de espaço isolado da demo (`demoScope`) é a base para um `tenantId` em todas as consultas.
4. **Busca vetorial no banco.** Com centenas de artigos por cliente, trocar o cosseno em memória por índice vetorial (o libSQL tem `vector`), mantendo a mesma margem e o mesmo avaliador.
5. **Limites por cliente.** O livro-caixa ganha um teto por cliente, além do global, e o console mostra o gasto do mês.

### Acima de 50.000 funcionários: roteamento de modelos e provedores redundantes

1. **Roteamento em cascata.** Perguntas simples (saudação, horário, status de chamado) vão para um modelo menor; o agente completo fica para o que precisa de tools. A simulação de roteamento já existe nos evals; antes de ligar, medir a efetividade por rota.
2. **Dois provedores com o mesmo modelo.** O modelo reserva hoje está desligado porque o teto vale para um provedor só. Com o livro-caixa por provedor, ligar um segundo provedor e manter o disjuntor que já protege os embeddings.
3. **Avaliação contínua.** Os evals com modelo real rodam no CI com limiar mínimo, numa amostra por dia, com o custo no mesmo livro-caixa.

## O que não muda com a escala

- As regras do service desk continuam em código testado (prioridade, prazo, duplicidade, confirmação), não no prompt.
- A identidade vem sempre da sessão; nenhum argumento do modelo escolhe de quem é o chamado.
- O agente nunca recebe imagem, só a descrição marcada como conteúdo não confiável.
- Toda chamada paga passa pelo livro-caixa antes de acontecer.

## Indicadores para acompanhar

| Indicador | Onde ver hoje | Alerta sugerido |
|---|---|---|
| p95 de latência do turno | Indicadores do console; métricas do Prometheus | acima de 30 s |
| Gasto do dia | livro-caixa (`usage_counters`) | 80% do teto diário |
| Resolução sem analista | Indicadores (resolução honesta) | queda de 10 pontos na semana |
| Turnos com degradação na busca | raio-X da busca; métricas | acima de 5% dos turnos |
| Consultas de assinatura por segundo | logs do Turso | acima de 200/s (hora de trocar por eventos) |
