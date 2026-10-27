/**
 * G-Eval (Liu et al., 2023 — https://arxiv.org/abs/2303.16634) adaptado ao Nexo Assist.
 *
 *   1. Auto-CoT: o juiz escreve, uma vez, os passos de avaliação de cada critério.
 *      Os passos ficam congelados em JSON (reprodutível e revisável por gente).
 *   2. Form-filling: o juiz lê regras + conversa + passos e preenche só as notas.
 *   3. Nota ponderada: em vez da nota escolhida, a média 1–5 ponderada pela
 *      probabilidade de cada dígito (logprobs). Isso dá notas contínuas e separa
 *      empates que a nota inteira esconde. Sem logprobs, média de n amostras.
 */
import { NEXO_INSTRUCTIONS } from "@/agent/instructions";
import type { TokenLogprob } from "./openrouter";

export interface Criterion {
  id: string;
  name: string;
  definition: string;
  /** De onde o critério vem no PRD do desafio (rastreabilidade). */
  prd: string;
  /** Regras e specs do projeto que o critério cobra. */
  rules: string;
}

/**
 * Critérios derivados de como o desafio avalia o agent (PRD, "Como vamos avaliar":
 * qualidade das decisões, condução da conversa, transparência), do Anexo A (regras do
 * service desk) e das specs. Ids sem acento: o juiz repete o id e o parser procura por ele.
 */
export const CRITERIA: Criterion[] = [
  {
    id: "decisao",
    name: "Qualidade da decisão",
    definition:
      "Entende o que o funcionário quer e escolhe a ação certa: dúvida → central de ajuda; consulta → chamados dele; problema relatado → verifica chamado parecido antes de abrir outro; complemento → atualização; analista quando pedido, em caso crítico ou chamado vencido. Usa só dados que as ferramentas devolveram, sem inventar.",
    prd: "Como vamos avaliar: Qualidade das decisões · Sucesso: resolução sem fila, encaminhamento certo",
    rules: "specs/02-agent (linha de ação por intenção) · instructions.ts",
  },
  {
    id: "regras",
    name: "Regras do service desk",
    definition:
      "Segue o Anexo A: só cria ou atualiza chamado depois da confirmação do funcionário; não duplica (atualiza o aberto, reabre resolvido há até 7 dias); transfere quando pedido, em caso crítico, chamado vencido ou sem segurança; nunca passa dados de chamado de outra pessoa; fora de TI, redireciona; prioridade coerente com impacto × urgência.",
    prd: "Anexo A (abertura, duplicidade, transferência, privacidade, escopo, prioridade) · Segurança e privacidade",
    rules: "specs/01-regras-do-service-desk · specs/03 (motivos de transferência)",
  },
  {
    id: "conducao",
    name: "Condução da conversa",
    definition:
      "Pergunta quando falta informação, UMA coisa por vez e com opções rápidas quando cabe; não pergunta o que o funcionário já disse; confirma antes de agir; mantém o contexto entre as mensagens.",
    prd: "Como vamos avaliar: Condução da conversa · História 4 (conferir os dados antes de criar)",
    rules: "instructions.ts (uma pergunta por vez, offerQuickReplies) · specs/02",
  },
  {
    id: "clareza",
    name: "Clareza da resposta",
    definition:
      "Resposta direta, em até 3 frases, sem jargão, sem repetir no texto o que os cards já mostram e sem ecoar notas internas do sistema (texto entre ⟦ ⟧, colchetes de card, nomes de tools).",
    prd: "Como vamos avaliar: Condução da conversa (responde de forma clara) · Eficiência",
    rules: "instructions.ts (no máximo 3 frases, não repetir o card) · model-history.ts (notas ⟦sistema⟧)",
  },
  {
    id: "transparencia",
    name: "Transparência do raciocínio",
    definition:
      "O registro de entendimento (recordUnderstanding) de cada turno — que o funcionário vê no painel 'por quê?' — tem a intenção certa, um 'o que entendeu' fiel à mensagem, confiança calibrada (alta quando está claro, baixa quando é ambíguo) e um motivo coerente com a ação que o agent tomou de fato.",
    prd: "Como vamos avaliar: Transparência · Visibilidade das decisões ('a parte mais importante do desafio')",
    rules: "tools/understanding.ts (confiança < 0,5 transfere) · specs/02 (trace)",
  },
  {
    id: "tom",
    name: "Tom e empatia",
    definition: "Cordial, profissional e acolhedor com quem está com um problema, sem ser frio, robótico ou exagerado.",
    prd: "Contexto: agent de atendimento que substitui o formulário",
    rules: "instructions.ts (frases curtas, cordiais e sem jargão)",
  },
  {
    id: "idioma",
    name: "Português do Brasil",
    definition:
      "Português do Brasil correto e natural: gramática, concordância, vocabulário brasileiro (não europeu), sem trechos em inglês ou anglicismos desnecessários.",
    prd: "Contexto: funcionários da Nexo (empresa brasileira) conversando no chat",
    rules: "instructions.ts (fale em português do Brasil)",
  },
];

export type Steps = Record<string, string>;

/** Pedido do auto-CoT (passo 1), no formato do artigo do G-Eval. */
export function stepsPrompt(criterion: Criterion) {
  return [
    {
      role: "user" as const,
      content: [
        "Você receberá uma conversa entre um funcionário e o Nexo Assist, o agent de service desk de TI de uma empresa brasileira.",
        "A conversa traz as mensagens, as ações do agent (tools com entrada e saída), os cards exibidos e, em cada turno, o registro de entendimento do agent (intenção, o que entendeu, confiança de 0 a 1 e motivo), que o funcionário vê no painel 'por quê?'.",
        "Sua tarefa é avaliar a conversa em um critério.",
        "",
        "Critério de avaliação:",
        `${criterion.name} (1 a 5) — ${criterion.definition}`,
        "",
        "Escreva os Passos de Avaliação: de 3 a 5 passos numerados, objetivos e verificáveis, que um avaliador deve seguir para dar a nota neste critério. Responda só com os passos, em português.",
      ].join("\n"),
    },
  ];
}

/**
 * Pedido de avaliação (passo 2): todos os critérios num formulário só.
 * Ordem pensada para o cache do provedor: tudo que é fixo (papel, regras, critérios,
 * passos, formato) vem primeiro e é idêntico em toda chamada; a conversa, que muda,
 * vem por último.
 */
export function judgePrompt(transcript: string, steps: Steps) {
  const criteria = CRITERIA.map((c) => [`### ${c.id} — ${c.name}`, c.definition, "Passos de avaliação:", steps[c.id] ?? "(sem passos)"].join("\n"));
  return [
    {
      role: "system" as const,
      content: [
        "Você é um avaliador rigoroso e imparcial de atendimento de service desk de TI em português do Brasil. Avalie só o que está na conversa. Não premie respostas longas: o agent deve responder em até 3 frases e os cards mostram os detalhes.",
        "",
        "## Regras que o agent recebeu",
        NEXO_INSTRUCTIONS,
        "",
        "## Critérios (nota inteira de 1 a 5; 5 = excelente)",
        ...criteria,
        "",
        "## Formato da resposta",
        `Responda exatamente ${CRITERIA.length} linhas, nesta ordem, só com a nota, sem explicação:`,
        ...CRITERIA.map((c) => `${c.id}: <nota>`),
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: ["Avalie esta conversa entre um funcionário e o Nexo Assist.", "", transcript].join("\n"),
    },
  ];
}

const SCORE_TOKEN = /^[\s:=*]*([1-5])\s*$/;

/**
 * Nota esperada a partir das alternativas de um token: Σ p(nota) × nota,
 * normalizada pela massa dos dígitos 1–5. Null se os dígitos quase não aparecem.
 */
export function expectedScore(alternatives: Array<{ token: string; logprob: number }>): number | null {
  let mass = 0;
  let weighted = 0;
  for (const alt of alternatives) {
    const digit = SCORE_TOKEN.exec(alt.token)?.[1];
    if (!digit) continue;
    const p = Math.exp(alt.logprob);
    mass += p;
    weighted += p * Number(digit);
  }
  return mass >= 0.5 ? weighted / mass : null;
}

export interface ParsedScores {
  scores: Record<string, number>;
  methods: Record<string, string>;
}

/**
 * Percorre os tokens da resposta: quando o texto acumulado termina em "<id>:",
 * o próximo token que for um dígito é a nota daquele critério.
 */
export function scoresFromLogprobs(tokens: TokenLogprob[]): ParsedScores {
  const ids = new Set(CRITERIA.map((c) => c.id));
  const result: ParsedScores = { scores: {}, methods: {} };
  let buffer = "";
  let pending: string | null = null;

  for (const token of tokens) {
    const digit = SCORE_TOKEN.exec(token.token)?.[1];
    if (pending && digit) {
      const expected = expectedScore(token.top_logprobs.length ? token.top_logprobs : [token]);
      result.scores[pending] = expected ?? Number(digit);
      result.methods[pending] = expected === null ? "texto" : "logprobs";
      pending = null;
      buffer = "";
      continue;
    }
    buffer += token.token;
    const label = /([a-z]+)\s*[:=]\s*$/i.exec(buffer)?.[1]?.toLowerCase();
    if (label && ids.has(label) && !(label in result.scores)) pending = label;
  }
  return result;
}

/** Notas lidas do texto ("clareza: 4"), para juízes sem logprobs. */
export function scoresFromText(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const c of CRITERIA) {
    const match = new RegExp(`${c.id}\\s*[:=]\\s*\\**\\s*([1-5])`, "i").exec(text);
    if (match) scores[c.id] = Number(match[1]);
  }
  return scores;
}
