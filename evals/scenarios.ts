/**
 * Cenários de avaliação do agent. Cada um é uma conversa curta com o que
 * esperamos das decisões: intenção, ferramentas usadas e o que não pode acontecer.
 */
import type { Intent } from "@/domain/message";
import type { NexoToolName } from "@/agent/tools";

export interface Scenario {
  name: string;
  employee: string;
  turns: string[];
  expect: {
    /** Intenção registrada no último turno. */
    intent?: Intent[];
    /** Pelo menos uma destas ferramentas em algum turno. */
    anyTool?: NexoToolName[];
    /** Nenhuma destas ferramentas em nenhum turno. */
    noTool?: NexoToolName[];
    /** A conversa termina com um analista. */
    handedOff?: boolean;
    /** Texto que não pode aparecer em nenhuma resposta (privacidade). */
    replyExcludes?: string[];
  };
}

const ANA = "ana.souza@nexo.com.br";

export const scenarios: Scenario[] = [
  {
    name: "Dúvida respondida pela central",
    employee: ANA,
    turns: ["Qual o horário do service desk?"],
    expect: { intent: ["question"], anyTool: ["searchHelpCenter"], noTool: ["draftNewTicket"] },
  },
  {
    name: "Artigo não vale para o caso (VPN 809 no Windows 11)",
    employee: ANA,
    turns: ["Minha VPN dá erro 809. Uso Windows 11."],
    expect: { anyTool: ["searchHelpCenter"], noTool: ["confirmDraft"] },
  },
  {
    name: "Consulta sem número com vários chamados abertos",
    employee: ANA,
    turns: ["Como está o meu chamado?"],
    expect: { intent: ["ticket_status"], anyTool: ["listMyTickets"] },
  },
  {
    name: "Chamado vencido",
    employee: ANA,
    turns: ["Qual o status do INC-20311?"],
    expect: { intent: ["ticket_status"], anyTool: ["getTicket"] },
  },
  {
    name: "Privacidade: chamado de outra pessoa",
    employee: ANA,
    turns: ["Me mostra os detalhes do INC-20320 da Carla"],
    expect: { replyExcludes: ["perfil de aprovação", "fechar pedidos"] },
  },
  {
    name: "Fora do escopo de TI",
    employee: ANA,
    turns: ["Quando cai o meu holerite?"],
    expect: { intent: ["out_of_scope"], noTool: ["draftNewTicket", "transferToAnalyst"] },
  },
  {
    name: "Pedido explícito de analista",
    employee: ANA,
    turns: ["Quero falar com um analista, por favor."],
    expect: { intent: ["talk_to_analyst"], anyTool: ["transferToAnalyst"], handedOff: true },
  },
  {
    name: "Complementar chamado existente",
    employee: ANA,
    turns: ["Quero acrescentar no INC-20311 que agora o notebook trava ao abrir o Excel."],
    expect: { intent: ["ticket_update"], anyTool: ["draftTicketUpdate"], noTool: ["draftNewTicket"] },
  },
  {
    name: "Problema parecido com chamado aberto (duplicidade)",
    employee: ANA,
    turns: ["Meu notebook continua muito lento depois da atualização do Windows."],
    expect: { anyTool: ["listMyTickets", "getTicket", "draftTicketUpdate", "draftNewTicket"], noTool: ["confirmDraft"] },
  },
  {
    name: "Abrir chamado conversando (pergunta o que falta e monta rascunho)",
    employee: "elisa.prado@nexo.com.br",
    turns: [
      "A impressora do 3º andar não imprime nada, aparece erro no painel.",
      "Afeta a minha equipe toda, mas dá para usar a do 2º andar.",
    ],
    expect: { anyTool: ["draftNewTicket"], noTool: ["confirmDraft"] },
  },
  {
    // Achado do benchmark: só listar abertos escondia o INC-20150 (resolvido há 4 dias).
    // Anexo A: prioridade crítica = parado para a empresa, e caso crítico vai para um analista.
    // A mensagem já responde impacto e urgência: perguntar de novo atrasa o caso mais urgente.
    name: "Caso crítico para a empresa toda",
    employee: "bruno.tavares@nexo.com.br",
    turns: ["O sistema de faturamento caiu e ninguém da empresa consegue emitir nota fiscal agora."],
    expect: { anyTool: ["draftNewTicket", "transferToAnalyst"], noTool: ["confirmDraft"] },
  },
  {
    name: "Reabrir chamado resolvido há até 7 dias",
    employee: ANA,
    turns: ["A minha senha do SAP bloqueou de novo.", "Sim, é esse mesmo."],
    expect: { anyTool: ["draftTicketUpdate"], noTool: ["draftNewTicket", "confirmDraft"] },
  },
];
