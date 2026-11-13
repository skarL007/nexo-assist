/**
 * Textos e links da landing. Regra: nenhum fato ou número inventado. Tudo aqui sai do README,
 * de docs/validacao/ ou das telas do app; cada número leva a fonte junto.
 */
import { CASE_STUDY_URL } from "@/lib/brand";

export const DEMO_HREF = "/login";
export const HOW_IT_WAS_MADE_URL = CASE_STUDY_URL;
export const CODE_URL = "https://github.com/skarL007/nexo-assist";

/** Cor do céu no alto da cena do topo (com o véu): pinta a barra do navegador no celular. */
export const HERO_SKY = "#4a475f";
/** Fundo claro da página (o mesmo de --background), para a barra do navegador depois do topo. */
export const PAGE_LIGHT = "#f5f5f7";

const DOCS = `${CODE_URL}/blob/main/docs/validacao`;

export const NAV_LINKS = [
  { href: "#produto", label: "Produto" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#por-que", label: "Por quê?" },
  { href: "#analista", label: "Analista" },
  { href: "#numeros", label: "Números" },
] as const;

export const STEPS = [
  {
    id: "passo-descreve",
    title: "Você descreve. O Farol consulta.",
    text: "Escreva com as suas palavras, sem formulário. Ele olha os seus chamados, busca na central de ajuda e pergunta só o que falta.",
    shot: "passo-1",
    alt: "Chat do Farol Desk: Elisa escreve que o Wi-Fi da sala 3 voltou a cair. O Farol responde que o chamado INC-20319 está em andamento e pergunta se deve acrescentar a nova queda.",
  },
  {
    id: "passo-confirma",
    title: "Ele monta o chamado e espera o seu sim.",
    text: "Prioridade e prazo saem de regras em código. Você confere, altera os detalhes se quiser e confirma. Sem confirmação, nada é criado.",
    shot: "passo-2",
    alt: "Rascunho do chamado “Monitor não liga”, aguardando confirmação: incidente de hardware, prioridade Alta, afeta somente a funcionária, com os botões Confirmar, Alterar detalhes e Cancelar.",
  },
  {
    id: "passo-analista",
    title: "Quando precisa, chama um analista.",
    text: "Se você pedir, se o caso for crítico, se o prazo venceu ou se o agent não tiver segurança. O analista recebe o resumo do caso.",
    shot: "passo-3",
    alt: "Console do analista na conversa da Carla: o resumo da transferência diz que ela precisa de acesso de aprovação no SAP ainda hoje e pediu para falar com um analista; abaixo, as mensagens e a resposta do Farol avisando que chamou um analista.",
  },
] as const;

export const WHY_ROWS = [
  { label: "O que entendeu", text: "A intenção e o pedido, registrados antes de qualquer ação." },
  { label: "O que fez", text: "Cada ferramenta chamada, com o resultado." },
  { label: "Confiança", text: "De 0 a 100%. Abaixo de 50%, ele pergunta; se continuar assim, transfere." },
  { label: "Regras que agiram", text: "Quando uma regra em código interferiu, ela aparece com o motivo." },
  { label: "Telemetria", text: "O trace, o tempo de cada ferramenta e o raio‑X da busca na central." },
] as const;

export const ANALYST_FEATURES = [
  {
    title: "Relatório da conversa",
    text: "O que a pessoa precisa, o que o agent já fez e o que falta. Montado do histórico, sem chamar o modelo.",
  },
  {
    title: "Sugerir resposta",
    text: "O modelo escreve um rascunho. O analista revisa antes de enviar.",
  },
  {
    title: "Incidente em massa",
    text: "Várias pessoas com o mesmo problema em poucas horas: a fila avisa e o impacto sobe, sem revelar quem relatou.",
  },
] as const;

export const NUMBERS = [
  {
    value: "574",
    caption: "testes unitários em 77 arquivos, sem chamar o modelo",
    source: "Validação de 13/11/2026",
    href: `${DOCS}/ENTREGA-2026-11-13.md`,
  },
  {
    value: "69/69",
    caption: "testes E2E contra o build de produção",
    source: "Validação de 13/11/2026",
    href: `${DOCS}/ENTREGA-2026-11-13.md`,
  },
  {
    value: "33/35",
    caption: "cenários executados com o modelo real; 1 adicional bloqueado pelo teto",
    source: "Evals de 13/11/2026 · 2 falhas registradas",
    href: `${DOCS}/ENTREGA-2026-11-13.md`,
  },
  {
    value: "21/21",
    caption: "rodadas de red team: 7 ataques, 3 vezes cada",
    source: "Red team",
    href: `${DOCS}/RED-TEAM.md`,
  },
] as const;
