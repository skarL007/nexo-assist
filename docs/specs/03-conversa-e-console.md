# 03 · Conversa, transferência e console

## Estados da conversa

```
with_agent ──handoff──▶ waiting_analyst ──assume──▶ with_analyst
     ▲                        │                          │
     └────────── release ◀────┴──────────────────────────┘
(qualquer estado aberto) ──close──▶ closed
```

- O agent só responde em `with_agent`. Nos outros estados, a mensagem do funcionário é salva e fica para o analista.
- Toda transição gera uma mensagem de sistema (a divisória no histórico).
- A transferência leva **motivo** (pedido do funcionário, caso crítico, chamado vencido, baixa confiança), **resumo** e, se houver, o chamado relacionado.

## Login

- Entram só as pessoas dos dados de exemplo, com qualquer senha não vazia (Tela 1 do PDF). Não há cadastro.
- Os botões de demonstração ("Ana · funcionária", "Rafael · analista") entram com um clique.
- Senha vazia mostra "Informe uma senha (na demonstração, qualquer uma funciona)". "Esqueci minha senha" explica o mesmo.
- "Manter conectado neste computador" (Tela 1 do protótipo): marcado, a sessão dura 7 dias; desmarcado, o cookie some quando o navegador fecha (e a sessão vence em 8 horas de qualquer jeito).
- "Meu perfil" mostra o e-mail com o selo "Gerenciado pela TI", como no protótipo.
- Os números do painel do login são **deste ambiente**, dos últimos 30 dias: tempo médio de resposta do agent, % resolvido sem analista e analistas no service desk (antes eram os do protótipo, fixos). Sem dados, aparece "—". Se o banco falhar, o login abre mesmo assim.
- **SSO opcional (OpenID Connect).** Com `OIDC_ISSUER`, `OIDC_CLIENT_ID` e `OIDC_CLIENT_SECRET` definidos, o login mostra "Entrar com {OIDC_LABEL}" (ex.: Microsoft Entra, Google Workspace, Okta). Fluxo authorization code com PKCE (S256), `state` e `nonce` num cookie assinado de 10 minutos. O `id_token` é validado (assinatura pelo JWKS do provedor, `iss`, `aud`, `exp`, `nonce`, e-mail verificado e, com `OIDC_ALLOWED_DOMAIN`, o domínio). Entra só quem já é funcionário da base (ninguém é criado pelo SSO). Aceite: `e2e/sso.spec.ts` contra um provedor OIDC falso: Ana entra pelo SSO e cai no chat; e-mail fora da base volta ao login com "Seu e-mail não está no service desk"; `state` adulterado é recusado. Sem as variáveis, nada muda.

## "Isso resolveu?"

- Embaixo da última resposta do agent (as que passaram pelo modelo) aparece "Isso resolveu? Sim / Não". "Não" oferece "Falar com um analista" (manda o pedido como mensagem) e "Na verdade, resolveu". Avaliar de novo troca a anterior.
- A avaliação fica gravada (`message_feedback`): recarregar mantém, e o analista vê "Funcionário: resolveu / não resolveu" na resposta.
- Só a dona da conversa avalia, e só respostas do agent; mensagem de outra pessoa responde 404, igual a uma que não existe.

## Rascunho

- Um rascunho novo (de chamado ou de atualização) substitui o pendente anterior da conversa, que aparece como "Substituído" ("Descartado" fica só para o que o funcionário cancelou). Sem isso, ao corrigir um detalhe, o rascunho antigo continuava confirmável e dava para criar dois chamados do mesmo problema.
- **Alterar detalhes no próprio card.** O botão abre o rascunho para edição ali mesmo: título, descrição, tipo, categoria, quem é afetado e urgência (no rascunho de atualização, o comentário). A prioridade e o prazo são recalculados ao vivo pela matriz do Anexo A, e o card mostra o que muda antes de salvar. Salvar troca o rascunho por um novo, e o Nexo responde com o resumo das mudanças, sem chamar o modelo (não gasta o teto). Continua sendo rascunho: nada é criado sem Confirmar. Ainda dá para pedir a mudança escrevendo na conversa. Como não passa pelos limites de mensagens, há um teto de 20 rascunhos por conversa (`MAX_DRAFTS_PER_CONVERSATION`); depois disso, Salvar responde que o rascunho já foi alterado muitas vezes.
- A prioridade é sempre recalculada no servidor; o navegador só mostra a prévia. Se a mudança de tipo, categoria ou título deixar o rascunho parecido com um chamado aberto, a resposta lista os parecidos para escolher (regra de duplicidade).
- Aceite: rascunho com Afetados "Toda a empresa" e urgência "impede de trabalhar" (Crítica) → em Alterar detalhes, Afetados "Somente você" → a prévia mostra "Alta · 4 horas úteis"; salvar → card novo com Alta, o anterior "Substituído", e o Nexo responde "Afetados: Toda a empresa → Somente você · Prioridade: Crítica → Alta".
- Enquanto o Nexo responde, os botões do rascunho (e o Ctrl+Enter) ficam travados, com o aviso "Aguarde o Nexo responder para confirmar". A resposta em andamento foi montada com os rascunhos de antes; confirmar no meio dela deixava a resposta desatualizada ("o rascunho ainda está pronto").

## Páginas de erro

- Endereço que não existe mostra "Página não encontrada", em português e no visual do app, com link para voltar ao início (status 404).
- Erro inesperado numa tela mostra "Algo deu errado" com "Tentar de novo", sem detalhes técnicos.
- Falha ao enviar (sem conexão, sem chave do modelo) mostra o aviso em português e **devolve o texto ao campo**; nada do que o funcionário escreveu se perde.
- Erro ao confirmar, cancelar ou alterar um rascunho aparece no próprio card.
- Console: se abrir uma conversa falhar, mostra o erro com "Tentar de novo". Os chamados do painel vêm do sistema legado; se ele cair, a conversa abre mesmo assim e o painel avisa que está tentando de novo.
- Trocar de conversa no console limpa o texto digitado (não vai para outra pessoa).

## Sessão

- Uma conversa aberta por funcionário. Ao voltar, ele continua nela (história 6).
- Limite: 30 mensagens do funcionário por conversa. "Nova conversa" encerra a atual.

## Console do analista

- **Filtros:** Todas · Para você (aguardando atendente) · Com o agent · Minhas (assumidas por mim). Busca por nome, chamado ou texto.
- **Ordem:** fila primeiro (quem espera há mais tempo no topo) e depois por recência.
- **Linha de estado:** "Agent pediu ajuda · confiança 41%", "Transferida há 25 minutos", "Agent atendendo", "Você está atendendo".
- **Conversa:** resumo da transferência no topo e histórico com o trace do agent. Ações: Assumir; Devolver ao agent; Encerrar. Só quem assumiu pode responder.
- **Painel:** chamados do funcionário, com o da transferência em destaque.
- **Sugerir resposta** (só quem assumiu a conversa): o modelo escreve um rascunho a partir do relatório e das últimas 8 mensagens; ele vai para o campo, para o analista revisar e editar (nada é enviado sozinho). Passa pelo teto de custo do chat. Número de chamado que não está na conversa vira aviso (regra em código). Ao enviar, o servidor registra se a sugestão foi usada igual ou editada; Indicadores mostra a taxa. Eval com o modelo real: `npm run eval:sugestao`.
- **Tempo real (SSE).** O console e o chat (enquanto um analista atende) abrem um stream de eventos (`/api/console/stream`, `/api/chat/stream`). O servidor confere uma assinatura barata do banco a cada 1 s e avisa "mudou"; a tela busca de novo só então. Critério: com o stream, uma mensagem nova aparece no console em menos de 2 s no p95 (medido em `e2e/live.spec.ts`, contra o polling de 3–4 s). Se o stream cair, a tela volta ao polling de antes e mostra "atualiza a cada 4 s". Aba escondida fecha o stream; ao voltar, reabre e atualiza. Cada stream dura até 50 s e o navegador reconecta (limite da função na Vercel). `?ao-vivo=0` força o polling (para comparar).
- **Resolução honesta** (Indicadores). "Resolvido pelo agent" = confirmadas (último "Isso resolveu?" foi sim) + presumidas (a última fala do agent não foi pergunta, sem analista, sem chamado e sem rascunho pendente). Ficam de fora e aparecem separadas: viraram chamado, em andamento, reabertas (a mesma pessoa voltou com o mesmo assunto em até 7 dias), não resolveram, abandonadas e com analista. Mostra o custo por resolução e as definições em "Como contamos" (abre pelo teclado). Regras em `domain/resolution.ts`, com teste.
- **Lacunas da central** (Indicadores). Buscas do agent na central que não acharam artigo, agrupadas por termo comum; só temas com 3 ou mais buscas. Mostra quantas buscas e quantas dessas conversas viraram chamado ou analista, com uma fala de exemplo com e-mail, CPF, telefone, número de chamado e números longos mascarados. Aceite: as 3 conversas do seed sobre o projetor da sala de reunião (a central não tem artigo de projetor) aparecem como "projetor, sala · 3 buscas sem artigo · 100%" e o CPF do exemplo não aparece. Regras em `domain/knowledge-gaps.ts`, com teste.
- **Indicadores** (ícone de gráfico na barra do console, `/console/indicadores`, só analista): últimos 30 dias de % resolvido sem analista, tempo de resposta do agent (média e p95), "Isso resolveu?", custo estimado (tokens × preço do modelo), respostas do agent, confiança média, rascunhos confirmados e transferências por motivo. Só turnos do modelo entram em tempo e custo; as respostas do próprio sistema (Confirmar, Alterar detalhes) não. Sem dados, "—".
- **Relatório da conversa:** o botão "Relatório" no cabeçalho abre, acima do histórico, um resumo para o analista não precisar ler a conversa inteira: o que a pessoa precisa, por que foi transferida, o que o agent já fez (passos, artigos da central de ajuda, falhas), os chamados citados com status e prazo atuais e o que está pendente (espera por atendente, rascunho sem confirmar, chamado com prazo vencido). É montado do histórico e dos traces, sem chamar o modelo (não gasta o teto nem inventa nada). "Copiar" leva o relatório em texto, para colar no chamado.
- Aceite: conversa do Bruno (seed) → Relatório mostra o resumo da transferência, "Agent sem segurança para decidir · confiança 41%" e a pendência "Bruno espera um atendente desde…"; Copiar põe o mesmo conteúdo em texto na área de transferência. Chamados citados aparecem com o status de agora (teste unitário em `domain/conversation-report.test.ts`).

## API

| Método | Rota | Quem | Faz |
|---|---|---|---|
| POST | `/api/auth/login` | todos | `{ email, password }` → cookie de sessão |
| POST | `/api/auth/logout` | todos | apaga a sessão |
| GET | `/api/auth/sso` → `/api/auth/sso/callback` | todos | SSO (só com OIDC configurado) |
| GET | `/api/console/stream`, `/api/chat/stream` | analista / funcionário | SSE de "mudou" (tempo real) |
| POST | `/api/chat/feedback` | funcionário | `{ messageId, helpful }` |
| POST | `/api/console/conversations/:id/suggestion` | analista que assumiu | sugestão de resposta |
| GET | `/api/chat` | funcionário | conversa aberta (ou vazia) |
| POST | `/api/chat` | funcionário | `{ text }` → stream NDJSON |
| POST | `/api/chat/new` | funcionário | encerra a conversa atual |
| POST | `/api/chat/drafts/:id` | funcionário | `{ action: confirm \| cancel }` ou `{ action: edit, fields }` |
| GET | `/api/console/conversations` | analista | lista |
| GET | `/api/console/conversations/:id` | analista | detalhe + chamados |
| POST | `/api/console/conversations/:id` | analista | `{ action: assume \| release \| close }` |
| POST | `/api/console/conversations/:id/messages` | analista | `{ text }` |

Erros sempre no formato `{ error: string, code?: string }`. Regras de negócio viram 404/403/409/429/503 (`server/http.ts`).
