# Referências do Awwwards para a landing do Farol Desk

Pesquisa feita em 11/11/2026 para a página de produto (`/` para quem não está logado). O pedido era de 4 a 6 sites premiados de produto SaaS ou IA, com visual claro e minimalista, no espírito da Apple.

**Como foi conferido.** Para cada site, a página do Awwwards foi aberta para ler o prêmio, a data e as tags. Depois, o próprio site foi aberto num Chromium do Playwright, em 1440×900, com capturas da primeira dobra e de mais seis posições de rolagem. Os padrões abaixo saem dessas capturas. Nada foi copiado: layout, texto, imagem e marca são dos autores. Ficaram só os padrões.

## As quatro escolhidas

### 1. Attio

- **Awwwards:** https://www.awwwards.com/sites/attio
- **Site:** https://attio.com/
- **Prêmio:** Honorable Mention, 6 de abril de 2021. Tags: Technology, Startups, Clean, Minimal, Typography, UI design, Microinteractions.
- **O que aproveitamos:**
  - Título centralizado e curto, com a tela do produto logo abaixo, dentro de uma moldura de janela com borda fina. No Farol, a moldura recebe a captura real do rascunho de chamado.
  - Lista de etapas presa na lateral (sticky). A etapa ativa fica em preto e as outras em cinza, enquanto o conteúdo rola ao lado. É o "Como funciona" da landing.
  - Frase em dois tons: o começo em preto, o resto em cinza secundário. Assim a hierarquia sai de uma frase só, sem precisar de subtítulo.
  - Divisórias finas de 1 px separando blocos, sem sombra pesada.

### 2. Heron AI

- **Awwwards:** https://www.awwwards.com/sites/heron-ai
- **Site:** https://heronaiapp.com/
- **Prêmio:** Site of the Day, 12 de outubro de 2026 (7,7/10), e Developer Award (7,01/10). Tags: Technology, Storytelling, Content architecture, Interaction Design.
- **O que aproveitamos:**
  - Uma cor de destaque só, usada com parcimônia sobre um fundo claro e neutro. No Farol, o petróleo fica para a ação e o âmbar só para a marca e o "por quê?".
  - Um texto que descreve o agente pelo que ele faz e pelo limite que respeita ("propõe, e só edita depois da aprovação"). É o mesmo argumento do Farol: o chamado só é criado depois do sim.
  - Blocos de especificação em pares rótulo e valor, separados por linhas finas. Viraram a lista do que o painel "por quê?" mostra.
  - Observação: o site prende a rolagem numa animação de entrada, e as capturas depois da primeira dobra repetiram a mesma tela. Só os padrões visíveis na abertura foram usados.

### 3. Microsoft AI

- **Awwwards:** https://www.awwwards.com/sites/microsoft-ai
- **Site:** https://microsoft.ai/
- **Prêmio:** Site of the Day, 30 de novembro de 2025 (7,16/10), e Developer Award (7,35/10). Tags: Technology, Clean.
- **O que aproveitamos:**
  - Frases centralizadas e curtas, que entram com um leve desfoque e opacidade durante a rolagem. Na landing, isso aparece na frase "O modelo decide o que fazer. As regras ficam em código testado." Com `prefers-reduced-motion`, a animação é desligada.
  - Um único botão em pílula por bloco, com o texto da ação e nada mais.
  - Fundo quase branco e muito espaço vertical entre os blocos.

### 4. Weavy (hoje Figma Weave)

- **Awwwards:** https://www.awwwards.com/sites/weavy
- **Site:** https://weavy.ai/ (hoje redireciona para a página do Figma Weave; as capturas são dessa versão)
- **Prêmio:** Site of the Day, 28 de setembro de 2025 (7,2/10), e Developer Award (7,26/10). Tags: Technology, Startups, Clean, UI design.
- **O que aproveitamos:**
  - Tipografia muito grande, sem serifa, com tracking negativo, que ocupa a largura no título principal.
  - Peças do produto anotadas com rótulos pequenos, como uma legenda técnica. No Farol, cada linha do "por quê?" tem um rótulo curto e uma explicação de uma linha.
  - Uma frase grande no centro, com uma linha pequena de apoio embaixo, para abrir cada seção.

## O topo com o farol

O dono pediu que a landing abrisse com o farol 3D feito no Blender. A primeira versão era um vídeo num bloco preto, com corte seco para a página clara, e foi reprovada. A versão atual trata a cena como fundo de tela cheia, integrada ao layout:

- **A cena.** Render do Blender 5.3 (Cycles), em `farol-video/blender/farol_hq.py`, planos `landing` e `landing_retrato`: penhasco escaneado, céu HDRI de hora azul, mar e o farol modelado, com o feixe âmbar girando. Câmera fixa e loop de 10 segundos sem emenda (o feixe duplo fecha o ciclo em meia volta; o mar é fundido nos primeiros quadros). Há um enquadramento horizontal, com o farol no terço direito e o céu livre para o título, e um vertical para o celular, com o farol no alto e o texto sobre o penhasco escuro.
- **Integração.** O vídeo ocupa a primeira dobra inteira, atrás do título. A barra de navegação fica transparente sobre o céu e vira o vidro claro do app depois do topo. Na base, a cena some numa névoa até o cinza claro da página (`#f5f5f7`), sem linha de corte. Um véu azul-índigo, da cor das sombras do céu, garante o contraste do texto branco. Ao rolar, a cena anda mais devagar que a página e o texto apaga (desligado com `prefers-reduced-motion`).
- **O feixe como fio condutor.** O âmbar aparece no traço antes de cada rótulo de seção, num brilho fraco no começo da página clara, atrás do painel "por quê?" e de novo no cartão final, que reusa o quadro parado da cena.
- **Peso.** Pôster em WebP (primeiro quadro do loop) como LCP; vídeo em WebM e MP4, com arquivo próprio e menor para o celular. Com movimento reduzido, o vídeo nem é baixado.

A referência de composição continua sendo o **Cerebrium** (objeto 3D de um lado, tipografia grande do outro, botões junto do texto), agora sem o fundo preto:

- **Awwwards:** https://www.awwwards.com/sites/cerebrium
- **Site:** https://cerebrium.ai/
- **Prêmio:** Site of the Day, 10 de setembro de 2026 (7,39/10), e Developer Award (7,5/10). Tags: Technology, Startups, App Style, 3D, Storytelling.
- **O que ficou de fora:** o gradiente roxo e magenta. O resto da landing continua clara.

## Abertas e descartadas

| Site | Página no Awwwards | Prêmio conferido | Por que ficou de fora |
|---|---|---|---|
| Cleo AI | https://www.awwwards.com/sites/cleo-ai | Site of the Day, 23/05/2026, e Developer Award | O site (https://web.meetcleo.com/) mostrou uma verificação anti-robô ("Just a moment...") e não carregou no navegador automatizado. Como a página não foi vista, nenhum padrão foi tirado dela. |
| Cerebrium | https://www.awwwards.com/sites/cerebrium | Site of the Day, 10/09/2026, e Developer Award | Como referência geral, ficou de fora pelo visual escuro com gradiente roxo e magenta. Serviu só para a composição do topo com o farol (acima). |
| DeepBook | https://www.awwwards.com/sites/deepbook | Site of the Day, 03/11/2026, e Developer Award | Visual escuro, e o produto é uma plataforma de negociação, não SaaS de atendimento. |
| Function.ai | https://www.awwwards.com/sites/function-ai | Honorable Mention, 05/03/2026 | Visual preto e branco. Nas capturas, só a tela de carregamento apareceu. |
| Superlist | https://www.awwwards.com/sites/superlist | Site of the Day, 19/04/2021, e Developer Award | Fundo vermelho e ilustração 3D, longe do visual claro pedido. |
| Aspen Search | https://www.awwwards.com/sites/aspen-search | Site of the Day, 15/09/2026, e Developer Award | O visual é minimalista, em branco e #232323, mas o site é de uma empresa de recrutamento, não de um produto. |
| Fourmula AI | https://www.awwwards.com/sites/fourmula-ai | Site of the Day, 02/05/2026 | Paleta escura (#020108 com laranja). |

As listagens https://www.awwwards.com/websites/saas/, https://www.awwwards.com/websites/technology/, https://www.awwwards.com/websites/minimal/ e https://www.awwwards.com/websites/clean/ foram abertas. Na primeira página delas, só alguns sites tinham prêmio, e nenhum era SaaS claro. Por isso, a busca seguiu pelo arquivo de Sites of the Day (https://www.awwwards.com/websites/sites_of_the_day/, páginas 1 a 22), olhando os produtos de software e IA.
