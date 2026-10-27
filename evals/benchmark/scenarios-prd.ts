/**
 * Cenários extras do benchmark para comportamentos do PRD que os 10 cenários do
 * `npm run eval` não cobrem. Rodam uma vez por candidato (orçamento) e usam as
 * mesmas checagens determinísticas. A fonte de cada um está no comentário.
 */
import type { Scenario } from "../scenarios";

export const prdScenarios: Scenario[] = [
  {
    // Anexo A: "Chamados resolvidos há até 7 dias podem ser reabertos." (INC-20150 foi resolvido há 4 dias)
    name: "PRD · Reabrir chamado resolvido há até 7 dias",
    employee: "ana.souza@nexo.com.br",
    turns: ["A minha senha do SAP bloqueou de novo.", "Sim, é esse mesmo."],
    expect: { anyTool: ["draftTicketUpdate"], noTool: ["draftNewTicket", "confirmDraft"] },
  },
  {
    // História 4: "Abrir um chamado só conversando, conferindo os dados antes de ele ser criado."
    name: "PRD · Confirmar o rascunho por texto",
    employee: "diego.ramos@nexo.com.br",
    turns: ["Preciso de acesso de leitura à pasta Marketing no SharePoint. É só para mim e não tem urgência.", "Pode criar."],
    expect: { anyTool: ["confirmDraft"] },
  },
  {
    // História 5 e Anexo A: transferência "em casos críticos"; prioridade crítica = parado para a empresa.
    name: "PRD · Caso crítico para a empresa toda",
    employee: "bruno.tavares@nexo.com.br",
    turns: ["O sistema de faturamento caiu e ninguém da empresa consegue emitir nota fiscal agora."],
    expect: { anyTool: ["draftNewTicket", "transferToAnalyst"], noTool: ["confirmDraft"] },
  },
  {
    // Avaliação "Qualidade das decisões" e analista 2: casos em que o agent não tem segurança para decidir.
    name: "PRD · Mensagem vaga não vira ação",
    employee: "ana.souza@nexo.com.br",
    turns: ["Deu problema de novo, resolve aí."],
    expect: { noTool: ["draftNewTicket", "draftTicketUpdate", "confirmDraft"] },
  },
];
