# 06 · Layout responsivo

O sistema (login, atendimento do funcionário e console do analista) precisa funcionar do celular (390 px) ao desktop (1440 px), sem rolagem horizontal e com alvos de toque de pelo menos 44 px.

## Funcionário

- A partir de 768 px, a barra lateral fica fixa à esquerda. Abaixo disso, vira uma barra no topo com a marca e os atalhos (Atendimento, Meu perfil, Sair).
- No celular, a resposta do agent ocupa a largura toda da conversa (o farol sobe para a linha do nome), o cartão de escolha de chamado mostra o estado embaixo do título e o rascunho empilha os botões (Confirmar em cima; Alterar detalhes e Cancelar embaixo). O atalho `Ctrl ↵` só aparece onde há teclado.

### Estados da conversa

- Entre o envio e a primeira linha do servidor, o Farol já aparece "pensando…" (a tela não fica parada). Só enquanto o agent atende: com um analista na conversa, não.
- O campo de mensagem diz para quem a mensagem vai: "Escreva para o Farol…" com o agent, "Escreva para o analista…" enquanto espera um analista e "Escreva para <primeiro nome>…" quando um analista assumiu.
- O aviso acima do campo é laranja enquanto a pessoa espera e verde quando o analista está atendendo.

Testes: `e2e/chat-states.spec.ts`.

## Console do analista

O console tem três colunas: conversas, conversa aberta e chamados do funcionário.

| Largura | O que aparece |
|---|---|
| 1280 px ou mais | Trilho lateral, conversas, conversa aberta e chamados |
| 1024 a 1279 px | Trilho lateral, conversas e conversa aberta |
| Abaixo de 1024 px | Barra no topo e **um painel por vez**: a lista de conversas ou a conversa aberta |

Abaixo de 1024 px:

- O console abre na **lista de conversas** (a fila "Para você"). A conversa não aparece espremida ao lado.
- Tocar numa conversa abre a conversa na tela toda, com o botão **Voltar para as conversas** no cabeçalho.
- Voltar mostra a lista de novo, com a mesma aba e a mesma busca.
- A barra do topo leva a Conversas e Indicadores e mostra quantas conversas esperam atendimento.
- Os indicadores usam a mesma barra do topo e empilham os cartões.

### Critérios de aceite

1. Em 390 × 844, o analista entra e vê a fila; "Assumir atendimento" não está visível; a página não rola na horizontal.
2. Ao tocar em "Bruno Tavares", vê a conversa com "Assumir atendimento" e o botão "Voltar para as conversas"; a lista não está visível; a página não rola na horizontal.
3. Ao tocar em "Voltar para as conversas", vê a lista de novo.
4. Em 390 × 844, `/console/indicadores` mostra os indicadores sem rolagem horizontal e o menu do topo leva de volta a `/console`.
5. Em 1440 × 900, nada muda: lista e conversa aparecem lado a lado e não existe botão de voltar visível.

Testes: `e2e/console-mobile.spec.ts`.
