# 01 · Regras do service desk

Fonte: Anexo A do desafio. Tudo aqui é código puro em `src/domain/` e tem teste.

## Chamado

- **Tipos:** `INC` (algo parou ou não funciona) e `REQ` (pedido de acesso, equipamento ou software).
- **Categorias:** Acesso, Rede e VPN, Hardware, Software, E-mail, Outros.
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
