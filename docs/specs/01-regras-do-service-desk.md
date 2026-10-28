# 01 · Regras do service desk

Fonte: Anexo A do desafio. Tudo aqui é código puro em `src/domain/` e tem teste.

## Chamado

- **Tipos:** `INC` (algo parou ou não funciona) e `REQ` (pedido de acesso, equipamento ou software).
- **Categorias:** Acesso, Rede e VPN, Hardware, Software, E-mail, Outros.
- **Programa de e-mail é E-mail, não Software.** Outlook, Thunderbird, webmail, caixa de entrada, Exchange e calendário do e-mail vão para a fila de E-mail. Se o modelo mandar um chamado novo com esses termos no título como Software, o código corrige para E-mail antes da duplicidade e da prioridade, e o trace registra a correção (`categoryForTitle` em `domain/ticket.ts`). Outras categorias escolhidas pelo modelo não mudam. Aceite: título "Outlook não abre desde a atualização" com categoria `software` → `email`; "Instalar o Power BI Desktop" continua `software`; "VPN não conecta" com `network` continua `network`.
- **Campos obrigatórios:** título, descrição, tipo, categoria, prioridade e quem é afetado (impacto).
- **Status:** aberto, aguardando analista, em andamento, aprovado, resolvido.

## Prioridade = impacto × urgência

O modelo informa **impacto** (`me`, `team`, `company`) e **urgência** (`blocked`, `deadline_today`, `has_workaround`, `none`). O código calcula:

| Impacto \ Urgência | parado / compromisso hoje | há alternativa | sem urgência |
|---|---|---|---|
| Só a pessoa | Alta | Média | Baixa |
| Equipe | Crítica | Alta | Média |
| Empresa | Crítica | Alta | Média |

Aceite: `classifyPriority("team", "blocked")` → crítica; `("me", "deadline_today")` → alta, com motivo legível.

### Alternativa antes da prioridade

"Há alternativa" e "sem urgência" dão prioridades diferentes em todas as linhas da matriz (só a pessoa: Média × Baixa; equipe ou empresa: Alta × Média). Num incidente, "sem urgência" sem saber se há alternativa pode baixar a prioridade de algo que atrapalha o trabalho. Achado do funcionário simulado de 28/10 (`outlook-direto` #2): o simulador clicou "Sem urgência" sem contar que usava o webmail, e o INC saiu Baixa em vez de Média.

Regra em código (`decideWorkaround` em `domain/workaround.ts`), aplicada pelo `draftNewTicket` antes da prioridade:

- **Pergunta** antes do rascunho só quando tudo isto vale: é `INC`; a urgência informada é `none`; nenhuma mensagem do funcionário na conversa já falou de alternativa ou de conseguir trabalhar (ex.: "uso o webmail", "dá para trabalhar", "não tenho alternativa", "estou parada"); o agent ainda não perguntou sobre alternativa na conversa (texto ou botões); e o agent fez menos de **3 perguntas** na conversa (`MAX_INTAKE_QUESTIONS`: respostas terminadas em "?", a mesma definição do limite `maxQuestions` dos evals; botões sozinhos, como a oferta de analista, não contam). Nesse caso o rascunho não é montado, o código põe os botões **"Tenho alternativa" / "Não tenho alternativa"** e a tool manda perguntar se há outro jeito de trabalhar enquanto isso. A pergunta acontece no máximo uma vez por conversa.
- **REQ** não pergunta: num pedido, "sem urgência" é o normal.
- **Urgência já informada** (`blocked`, `deadline_today`, `has_workaround`) não pergunta: a resposta não mudaria a prioridade.
- **Resposta pelos botões:** se a última resposta do funcionário aos botões foi "Tenho alternativa" e o modelo mandar `none`, o código corrige a urgência para `has_workaround`, recalcula a prioridade e o trace registra a correção. "Não tenho alternativa" mantém a urgência que o modelo mandou.
- Sem chegar a perguntar (limite de perguntas ou alternativa já mencionada), o rascunho sai com a urgência que o modelo mandou.

Aceite (`domain/workaround.test.ts`): INC "Outlook não abre", só eu, `none`, nada sobre alternativa e 1 pergunta feita → pergunta; mesmo caso depois de "Tenho alternativa" → `has_workaround` (Média); REQ `none` → não pergunta; `blocked` ou `has_workaround` → não pergunta; "o webmail funciona" numa mensagem → não pergunta; agent já perguntou "Tem alguma alternativa?" → não pergunta de novo; 3 perguntas já feitas → não pergunta; o `vago-outlook` #2 da rodada 3 (2 respostas com "?", mais botões e oferta de analista) → pergunta. Eval "Alternativa: pergunta antes da prioridade quando não sabe".

## Prazo (SLA)

| Prioridade | Prazo |
|---|---|
| Crítica | 1 hora corrida (plantão 24h) |
| Alta | 4 horas úteis |
| Média | 3 dias úteis |
| Baixa | 5 dias úteis |

- Expediente: segunda a sexta, 8h–18h, horário de Brasília. Um dia útil tem 10 horas.
- O prazo corre a partir da **última atualização**. Passado o prazo, o chamado está **vencido**. Resolvido não tem prazo.

Aceite: sexta 17h + 4h úteis = segunda 11h; pedido no sábado começa a contar segunda 8h.

## Duplicidade e reabertura

- Antes de montar um rascunho novo, procurar chamados do funcionário abertos ou resolvidos há até 7 dias que sejam **do mesmo tipo (INC/REQ), da mesma categoria e tenham palavra relevante em comum no título** (sem acentos, sem palavras vazias nem genéricas como "problema" e "erro"). Se houver, mostrar a lista e perguntar se é um deles.
- Só a categoria não basta: "Tela não está ligando" não é o mesmo problema que "Segundo monitor para home office", embora os dois sejam de Hardware; e um pedido de monitor novo (REQ) não é o mesmo problema que "Monitor da direita não liga" (INC). Só o título conta, porque a descrição traz palavras genéricas demais.
- Confirmar com o sistema de chamados instável: se a falha vier antes de gravar, o rascunho volta a ficar pendente; depois que o chamado (ou o comentário) foi gravado, nada é desfeito, para o próximo Confirmar não duplicar. Em caso crítico, a transferência vem antes de marcar o chamado; se ela falhar, a resposta avisa.
- Se for, o caminho é **atualizar** (comentário) o existente. Resolvido há até 7 dias é reaberto ao confirmar. Depois disso, abre-se um novo.
- **Problema diferente não vai para o chamado existente.** Ao montar uma atualização, o agent informa a categoria do problema que o comentário descreve. Se ela não for do mesmo assunto da categoria do chamado, o rascunho não é montado e a tool manda propor um chamado novo (`sameSubject` em `domain/ticket.ts`). Hardware e Software contam como o mesmo assunto, porque o sintoma de um aparece no outro ("o notebook trava ao abrir o Excel" complementa "Notebook lento"). Aceite: comentário de E-mail ("Outlook não abre") no INC-20311 (Hardware) → recusado com a instrução de abrir chamado novo; comentário de Software no INC-20311 → aceito; comentário de Acesso no INC-20150 (Acesso) → aceito.

## Privacidade

- Um funcionário só vê os próprios chamados e conversas.
- Chamado de outra pessoa responde "não encontrado", sem confirmar que existe.
- A identidade vem da sessão, nunca de um parâmetro que o modelo preenche.

## Escopo

Apenas TI. RH, financeiro e facilities são redirecionados sem abrir chamado.

## Aviso proativo de prazo (com o porquê)

- Um chamado aberto entra em **risco** quando 75% ou mais da janela do SLA já passou (em tempo útil; crítico em tempo corrido), e fica **vencido** depois do prazo. Cálculo em `domain/sla-risk.ts`, sem o modelo.
- O aviso mostra a conta: prioridade e janela, de quando conta (última atualização), prazo, quanto falta ou o atraso em tempo útil e quanto o relógio ficou parado fora do expediente.
- **Funcionário:** ao abrir o chat (com o agent), um aviso por chamado (até 2) com "por quê?", "Falar com um analista" (manda o pedido citando o chamado) e "Dispensar" (vale para a aba). Se o sistema de chamados cair, o chat abre igual, sem o aviso.
- **Analista:** o painel de chamados da conversa mostra os prazos com o porquê; Indicadores tem a fila "Prazos em risco agora" de todo mundo, vencidos primeiro.
- Aceite: seed → INC-20311 da Ana (média, atualizado há 6 dias) aparece como "venceu o prazo há …" no chat dela e na fila do console, com "Prioridade Média: resposta em até 3 dias úteis".
