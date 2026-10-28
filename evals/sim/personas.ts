/**
 * Personas do funcionário simulado. Cada uma tem um objetivo, fatos que só conta
 * se perguntarem e um jeito de escrever. O estado final esperado é conferido no
 * banco (chamado criado, nenhum chamado, transferência), não no texto.
 */
import type { SimExpect } from "./checks";

export interface Persona {
  id: string;
  employee: string;
  /** Primeira mensagem (fixa, para comparar execuções). */
  opening: string;
  /** Instruções para o modelo que faz o papel do funcionário. */
  brief: string;
  expect: SimExpect;
}

const ANA = "ana.souza@nexo.com.br";
const DIEGO = "diego.ramos@nexo.com.br";
const ELISA = "elisa.prado@nexo.com.br";

export const personas: Persona[] = [
  {
    id: "vpn-reuniao",
    employee: ANA,
    opening: "minha vpn nao conecta",
    brief: `Você é a Ana, do Financeiro. A VPN dá erro 809 no notebook com Windows 11.
Só conte se perguntarem: o erro é o 809; você já reiniciou o notebook e já seguiu o artigo da central (reinstalou o cliente), e não resolveu;
tem uma reunião com cliente às 15h de hoje e precisa da VPN para ela; só você está com o problema.
Escreve curto, sem acento, um pouco ansiosa. Quer um chamado aberto. Quando aparecer o rascunho certo, confirme.`,
    // Decisão de produto de 28/10: o analista só entra se o prazo do chamado vencer depois da reunião.
    expect: { ticket: { type: "INC", category: "network", priority: ["high"] }, handedOff: "only_if_sla_misses", neededBy: "15:00", maxQuestions: 3 },
  },
  {
    id: "horario",
    employee: DIEGO,
    opening: "Bom dia. Até que horas o service desk atende hoje?",
    brief: `Você é o Diego, do Jurídico. Só quer saber o horário do service desk. Quando receber o horário, agradeça e encerre.
Não quer abrir chamado nem falar com ninguém.`,
    expect: { noTicket: true, handedOff: false, maxQuestions: 1 },
  },
  {
    id: "power-bi",
    employee: ELISA,
    opening: "Preciso do Power BI Desktop instalado no meu notebook.",
    brief: `Você é a Elisa, do RH. Quer o Power BI Desktop instalado para montar relatórios.
Só conte se perguntarem: é só para você; não é urgente, dá para esperar alguns dias; o notebook é da empresa.
Escreve de forma educada e direta. Quando aparecer o rascunho certo, confirme.`,
    expect: { ticket: { type: "REQ", category: "software", priority: ["low", "medium"] }, handedOff: false, maxQuestions: 3 },
  },
  {
    id: "vago-outlook",
    employee: ANA,
    opening: "nada funciona aqui!!",
    brief: `Você é a Ana, do Financeiro, irritada e vaga no começo.
O problema real (conte só quando perguntarem o que exatamente não funciona): o Outlook não abre desde a atualização de ontem.
Se perguntarem mais: o webmail funciona, então dá para trabalhar; só você está com o problema; não tem prazo hoje.
Quando aparecer o rascunho certo, confirme.`,
    expect: { ticket: { type: "INC", category: "email", priority: ["medium"] }, handedOff: false, maxQuestions: 4, untouched: ["INC-20311"] },
  },
  {
    id: "muda-de-ideia",
    employee: DIEGO,
    opening: "O notebook está muito lento hoje, quero abrir um chamado.",
    brief: `Você é o Diego, do Jurídico. O notebook está lento.
Se perguntarem: só você; dá para trabalhar devagar; sem prazo hoje.
Quando o agent mostrar o rascunho do chamado, NÃO confirme: diga que acabou de reiniciar o notebook, voltou ao normal e não precisa mais.
Se ele perguntar se pode descartar, descarte (cancel). Depois encerre.`,
    expect: { noTicket: true, handedOff: false },
  },
  {
    id: "quer-pessoa",
    employee: ELISA,
    opening: "Quero falar com uma pessoa do service desk, não com robô.",
    brief: `Você é a Elisa, do RH. Quer falar com um analista sobre o Wi-Fi da sala 3, que voltou a cair.
Insista educadamente que quer uma pessoa. Se oferecerem um botão para falar com um analista, clique nele.`,
    expect: { handedOff: true, noTicket: true },
  },

  // ── Personas novas (28/10): exercitam as correções da rodada anterior e outros casos comuns.
  {
    // Achado do power-bi: a resposta rápida de urgência com o rascunho na tela virou "sim".
    id: "power-bi-urgencia",
    employee: ELISA,
    opening: "Oi! Vocês conseguem instalar o Power BI Desktop para mim?",
    brief: `Você é a Elisa, do RH. Quer o Power BI Desktop instalado no notebook da empresa para montar relatórios.
Só conte se perguntarem: é só para você; não é urgente, dá para esperar alguns dias.
Quando o rascunho aparecer na tela, ANTES de confirmar: se houver uma resposta rápida sobre urgência ou espera, clique nela; se não houver, escreva "posso aguardar uns dias, sem pressa".
Só no turno seguinte, se o rascunho continuar certo, clique em Confirmar.`,
    expect: { ticket: { type: "REQ", category: "software", priority: ["low", "medium"] }, handedOff: false, maxQuestions: 3 },
  },
  {
    // Achado do vago-outlook: o problema de e-mail foi parar no INC-20311 (notebook lento) e saiu como Software.
    id: "outlook-direto",
    employee: ANA,
    opening: "o outlook nao abre desde ontem",
    brief: `Você é a Ana, do Financeiro. O Outlook abre uma janela de erro e fecha, desde a atualização de ontem.
Só conte se perguntarem: o webmail funciona, então dá para trabalhar; só você está com o problema; não tem prazo hoje.
Você não lembra direito dos seus chamados antigos: se o agent perguntar se é sobre algum chamado que você já tem, responda "acho que sim, pode ser".
Quando aparecer um rascunho que fale do Outlook, confirme.`,
    expect: { ticket: { type: "INC", category: "email", priority: ["medium"] }, handedOff: false, maxQuestions: 4, untouched: ["INC-20311"] },
  },
  {
    // Decisão de produto: com o prazo atendendo a necessidade, o agent não oferece analista.
    id: "prazo-atende",
    employee: DIEGO,
    opening: "Preciso pedir um headset para as reuniões online, hoje eu não tenho nenhum.",
    brief: `Você é o Diego, do Jurídico. Quer pedir um headset novo (é um pedido de equipamento; hoje você usa o microfone do notebook, que funciona).
Só conte se perguntarem: é só para você; não é urgente; você precisa dele até sexta da semana que vem, dia 06/11.
Quando o rascunho aparecer, confirme. Depois que o chamado for aberto, pergunte se o headset chega até 06/11. Quando responderem, agradeça e encerre.`,
    expect: { ticket: { type: "REQ", category: "hardware", priority: ["low", "medium"] }, handedOff: false, noAnalystOffer: true, maxQuestions: 4 },
  },
  {
    // Problema igual a um chamado resolvido há até 7 dias: atualiza e reabre, não abre outro.
    id: "senha-sap",
    employee: ANA,
    opening: "minha senha do SAP bloqueou de novo",
    brief: `Você é a Ana, do Financeiro. O usuário do SAP bloqueou de novo depois de tentativas de login, igual da outra vez.
Se o agent perguntar se é o mesmo problema de um chamado anterior de senha do SAP, diga que sim.
Só conte se perguntarem: só você; está parada no SAP, mas consegue fazer outras coisas.
Quando aparecer o rascunho (de atualização ou de reabertura), confirme.`,
    expect: { noTicket: true, updated: ["INC-20150"], handedOff: false, maxQuestions: 3 },
  },
];
