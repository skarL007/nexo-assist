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
}

/** Ids sem acento: o juiz repete o id na resposta e o parser procura por ele. */
export const CRITERIA: Criterion[] = [
  {
    id: "resolucao",
    name: "Resolução da tarefa",
    definition:
      "A conversa resolve o pedido do funcionário ou o encaminha do jeito certo (resposta da central, status do chamado, rascunho, transferência), usando só dados que as ferramentas devolveram, sem inventar.",
  },
  {
    id: "conducao",
    name: "Condução da conversa",
    definition:
      "Quando falta informação, pergunta UMA coisa por vez; não pergunta o que o funcionário já disse; confirma antes de agir e nunca diz que criou ou atualizou um chamado sem confirmação.",
  },
  {
    id: "clareza",
    name: "Clareza e concisão",
    definition:
      "Resposta direta, em até 3 frases, fácil de entender, sem jargão e sem repetir no texto o que os cards já mostram.",
  },
  {
    id: "aderencia",
    name: "Aderência às regras do service desk",
    definition:
      "Segue as regras do agent: privacidade (não mostra chamado de outra pessoa), escopo só de TI, não inventa procedimento/número/prazo, transfere para analista quando pedido e não age depois de transferir.",
  },
  {
    id: "tom",
    name: "Tom e empatia",
    definition: "Cordial, profissional e acolhedor com quem está com um problema, sem ser frio, robótico ou exagerado.",
  },
  {
    id: "idioma",
    name: "Português do Brasil",
    definition:
      "Português do Brasil correto e natural: gramática, concordância, vocabulário brasileiro (não europeu), sem trechos em inglês ou anglicismos desnecessários.",
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

/** Pedido de avaliação (passo 2): todos os critérios num formulário só. */
export function judgePrompt(transcript: string, steps: Steps) {
  const criteria = CRITERIA.map((c) => [`### ${c.id} — ${c.name}`, c.definition, "Passos de avaliação:", steps[c.id] ?? "(sem passos)"].join("\n"));
  return [
    {
      role: "system" as const,
      content:
        "Você é um avaliador rigoroso e imparcial de atendimento de service desk de TI em português do Brasil. Avalie só o que está na conversa. Não premie respostas longas: o agent deve responder em até 3 frases e os cards mostram os detalhes.",
    },
    {
      role: "user" as const,
      content: [
        "Avalie a conversa entre um funcionário e o Nexo Assist (agent de service desk de TI).",
        "",
        "## Regras que o agent recebeu",
        NEXO_INSTRUCTIONS,
        "",
        "## Conversa",
        transcript,
        "",
        "## Critérios (nota inteira de 1 a 5; 5 = excelente)",
        ...criteria,
        "",
        "## Formato da resposta",
        `Responda exatamente ${CRITERIA.length} linhas, nesta ordem, só com a nota, sem explicação:`,
        ...CRITERIA.map((c) => `${c.id}: <nota>`),
      ].join("\n"),
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
