# Auditoria externa de 02/11/2026: os seis riscos e as correções

Em 02/11/2026, uma auditoria externa do código apontou seis riscos (dois de segurança, quatro de confiabilidade). Os seis foram conferidos no código antes de qualquer mudança, e os seis procediam. Cada correção seguiu o mesmo ciclo: **teste que reproduz o defeito e falha, correção mínima, teste passando, suíte inteira passando.**

A auditoria classificou o projeto em 8,5/10 como portfólio júnior e 5,5/10 em prontidão empresarial. Este relatório cobre só os riscos de código; carga, desempenho e evidência do CI continuam pendentes (seção "O que ainda falta").

## Os seis pontos

| # | Prioridade | Defeito | Prova de que existia | Correção | Teste |
|---|---|---|---|---|---|
| 1 | P0 | O login cria a sessão só com o e-mail, sem conferir a senha, em qualquer ambiente | `src/app/api/auth/login/route.ts` não lia a senha; o comentário em `env.ts` dizia "e-mail e senha" | O login de demonstração desliga sozinho com SSO configurado; `DEMO_LOGIN=0` ou `1` manda nos dois casos. Desligado, a rota responde 404 e a tela mostra só o SSO | `src/server/auth-mode.test.ts` (4 casos) |
| 2 | P1 | O OIDC aceitava token sem `email_verified` | `oidc.ts` só recusava `email_verified === false` | Exige `email_verified === true`; ausente ou `"true"` em texto é recusado | `src/server/oidc.test.ts` (2 casos novos falhavam antes) |
| 3 | P1 | Se um analista assumisse durante a inferência, o agente gravava a resposta mesmo assim | `run-turn.ts` lia o estado só no início do turno | Antes de gravar, o turno lê o estado de novo. Resposta vencida é descartada, o rascunho do turno é cancelado e fica uma mensagem de sistema no histórico | `src/domain/conversation.test.ts` (`agentReplyStillValid`, 2 casos) |
| 4 | P1 | Falha depois de gravar duplicava o comentário e o chamado | O simulador só falhava antes da escrita; na nova tentativa, o comentário saía em dobro e o chamado ganhava outro número | Chave de idempotência por rascunho (`draft:{id}`) com `UNIQUE` em `tickets` e `ticket_comments` (migração 0007); o simulador ganhou o modo `afterWrite` | `draft-service.test.ts` (5 casos: 4 falhavam), `ticket-service.test.ts` (falha sem a chave, passa com ela), `repositories.test.ts` (o UNIQUE no SQLite) |
| 5 | P2 | O teto total recusava, mas a vaga do dia já tinha sido gasta | Com o total esgotado, 3 tentativas deixavam o contador do dia em 4 em vez de 1 | Compensação: se o total recusa, a vaga do dia é devolvida (`release`, nunca abaixo de zero) | `model-budget.test.ts`, `repositories.test.ts` |
| 6 | P2 | Pedidos simultâneos abriam várias conversas para a mesma pessoa | No SQLite real, **20 pedidos simultâneos abriram 20 conversas** | Índice único parcial `conversations_one_open_idx` (migração 0008, que antes encerra duplicatas antigas e mantém a mais recente); quem perde a corrida recebe a conversa de quem ganhou | `repositories.test.ts` (20 simultâneos → 1 conversa, mesmo id para todos) |

## Decisões e limites de cada correção

- **Login (1):** o protótipo não tem senhas guardadas (a regra do desafio é "qualquer senha"). Por isso a correção não inventa uma autenticação por senha: separa os modos. Numa implantação de empresa, o caminho é o SSO, e com ele configurado o atalho por e-mail some. A demo pública (sem SSO) não muda. O E2E liga os dois de propósito, com `DEMO_LOGIN=1`.
- **Turno (3):** a revalidação acontece antes de gravar a resposta. As tools que alteram dados durante o turno já se protegem sozinhas: transferir para o analista dá `invalid_transition` se a conversa já mudou, e o rascunho só vira chamado quando o funcionário confirma. O teste cobre a regra; a corrida de ponta a ponta (T05 da auditoria) ainda não tem teste com modelo.
- **Idempotência (4):** depois da correção, o sistema se recupera sozinho mesmo com três respostas perdidas seguidas. A segunda gravação esbarra na chave e a nova tentativa acha o chamado pela chave. Só quando nem a consulta pela chave responde é que a confirmação falha, e o próximo Confirmar devolve o mesmo chamado.
- **Tetos (5):** a compensação mantém cada contador atômico. No pior caso, um pedido simultâneo é recusado um pouco antes, mas nenhum teto é ultrapassado.
- **Conversa (6):** a migração 0008 foi testada numa base com o seed mais três conversas abertas da mesma pessoa: ficou só a atualizada por último. Ela é segura para o Turso de produção, que pode ter duplicatas da corrida antiga.

## Verificação

| Etapa | Resultado |
|---|---|
| Unitários (`npm test`) | **490 passando em 69 arquivos** (antes eram 472) |
| `npm run typecheck` e `npm run lint` | Sem erros |
| E2E (`npm run test:e2e` e `test:e2e:demo`) | **42 passando + 1 da demo** (isolamento entre visitantes), contra o build de produção |
| Seed numa base nova | 10 pessoas, 14 artigos, 11 chamados, nenhuma conversa aberta em duplicata |
| Evals com modelo (`npm run eval`, `eval:sim`) | Não rodados: o turno do agente só ganhou a revalidação no fim, sem mudar prompt nem tools |

## O que ainda falta da matriz da auditoria

- **T03, T07, T09, T11, T12:** isolamento entre visitantes (existe `demo-isolation.test.ts`, falta o cenário cruzado da auditoria), confirmação dupla simultânea (o `claimPending` atômico já protege, falta o teste concorrente no banco real), injeção em artigo recuperado, reinício durante o atendimento e carga.
- **T05 de ponta a ponta:** analista assumindo durante uma inferência real.
- **Evidência do CI:** guardar o SHA, o link do pipeline do CircleCI e os relatórios de cada rodada.
- **Publicar:** as migrações 0007 e 0008 precisam ser aplicadas no Turso antes de publicar na Vercel (o `deploy-prod.ps1` migra). O Komodo migra sozinho ao subir a imagem nova.
