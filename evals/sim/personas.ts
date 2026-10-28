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
    expect: { ticket: { type: "INC", category: "network", priority: ["high"] }, handedOff: false, maxQuestions: 3 },
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
    expect: { ticket: { type: "INC", category: "email", priority: ["medium"] }, handedOff: false, maxQuestions: 4 },
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
];
