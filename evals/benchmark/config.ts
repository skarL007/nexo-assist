/**
 * Configuração do benchmark de modelos: quem concorre, quem julga, quanto pode gastar
 * e como os números viram uma decisão de negócio. Tudo que é escolha está aqui,
 * com o porquê ao lado — mudar o benchmark começa por este arquivo.
 */
import type { ReasoningEffort } from "@/agent/model-config";

export interface Candidate {
  /** Identificador único da configuração (vira nome de arquivo). */
  key: string;
  /** Modelo no catálogo do OpenRouter. */
  model: string;
  label: string;
  tier: "premium" | "intermediário" | "econômico";
  /** "minimal" = paridade com produção (thinkingLevel mínimo do Gemini direto). */
  effort: ReasoningEffort;
  why: string;
}

export const CANDIDATES: Candidate[] = [
  {
    key: "gemini-3.5-flash",
    model: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash (produção)",
    tier: "premium",
    effort: "minimal",
    why: "Linha de base: é o modelo de produção, aqui pelo OpenRouter para comparar maçã com maçã.",
  },
  {
    key: "gemini-3.8-flash",
    model: "google/gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    tier: "intermediário",
    effort: "minimal",
    why: "Flash mais novo e ~45% mais barato por token: caminho de upgrade sem trocar de fornecedor.",
  },
  {
    key: "gemini-3.5-flash-lite",
    model: "google/gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    tier: "econômico",
    effort: "minimal",
    why: "Mesmo fornecedor e geração, ~5x mais barato: o 'downgrade' óbvio para reduzir custo.",
  },
  {
    key: "gpt-6-luna",
    model: "openai/gpt-6-luna",
    label: "GPT-6 Luna",
    tier: "econômico",
    effort: "minimal",
    why: "Modelo rápido e barato da OpenAI, posicionado para chat de alto volume.",
  },
  {
    key: "deepseek-v4.1-flash",
    model: "deepseek/deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    tier: "econômico",
    effort: "minimal",
    why: "Pesos abertos, dezenas de provedores no OpenRouter: testa preço baixo com roteamento variável.",
  },
  {
    key: "mistral-small-4",
    model: "mistralai/mistral-small-2603",
    label: "Mistral Small 4",
    tier: "econômico",
    effort: "minimal",
    why: "Família europeia, barata, com tool calling nativo: diversidade de fornecedor.",
  },
  {
    key: "qwen3.8-flash",
    model: "qwen/qwen3.8-flash",
    label: "Qwen3.8 Flash",
    tier: "econômico",
    effort: "minimal",
    why: "Alibaba, forte em multilíngue. Com raciocínio ligado o provedor rejeita tool_choice forçado (achado do pré-voo).",
  },
  {
    key: "qwen3.8-flash-sem-raciocinio",
    model: "qwen/qwen3.8-flash",
    label: "Qwen3.8 Flash (sem raciocínio)",
    tier: "econômico",
    effort: "none",
    why: "Variante: com reasoning.effort=none o tool_choice forçado funciona. Mede o custo dessa adaptação.",
  },
];

export type JudgeMethod = "logprobs" | "amostragem";

export interface Judge {
  key: string;
  model: string;
  label: string;
  /** logprobs = média ponderada pela probabilidade de cada nota (G-Eval); amostragem = média de n respostas. */
  method: JudgeMethod;
  samples: number;
  effort: ReasoningEffort;
  /** Tokens por chamada para a estimativa (medidos nas âncoras de calibração). */
  tokens: { input: number; output: number };
}

/**
 * Painel de 2 juízes (PoLL) de famílias que NÃO concorrem: evita o viés de autopreferência.
 * Nenhum modelo da Anthropic via API (decisão do dono do projeto).
 */
export const JUDGES: Judge[] = [
  {
    key: "kimi-k3",
    model: "moonshotai/kimi-k3",
    label: "Kimi K3",
    method: "logprobs",
    samples: 1,
    effort: "none",
    tokens: { input: 3_000, output: 80 },
  },
  // GLM-5.3 não devolve logprobs pelo OpenRouter (testado) e não aceita desligar o raciocínio.
  {
    key: "glm-5.3",
    model: "z-ai/glm-5.3",
    label: "GLM-5.3",
    method: "amostragem",
    samples: 3,
    effort: "minimal",
    tokens: { input: 3_000, output: 250 },
  },
];

/** Quem escreve os passos de avaliação (auto-CoT do G-Eval), uma vez, congelados em JSON. */
export const STEPS_AUTHOR = JUDGES[0];

export const BUDGET = {
  /** Teto que o benchmark se impõe. A chave tem limite duro de US$ 2,00 no próprio OpenRouter. */
  capUsd: 1.8,
  /** Parte do teto guardada para os juízes enquanto os candidatos rodam. */
  judgeReserveUsd: 0.35,
  /** Margem sobre a estimativa de cada candidato antes de interromper o processo dele. */
  candidateSafetyFactor: 2,
};

/**
 * Tokens por turno para a estimativa de pré-voo. Medido no último `npm run eval`
 * (11 turnos, Gemini 3.5 Flash): 9.956 de entrada e 208 de saída. A saída leva folga
 * porque outros modelos gastam tokens de raciocínio.
 */
export const TOKENS_PER_TURN = { input: 10_000, output: 400 };

export const RUN = {
  repetitions: 2,
  /** Candidatos rodando ao mesmo tempo (cada um em seu processo e banco). */
  concurrency: 3,
  turnTimeoutMs: 90_000,
};

/** Peso de cada dimensão no score composto (soma 1). */
export const WEIGHTS = { effectiveness: 0.4, quality: 0.3, latency: 0.15, cost: 0.15 };
export type Weights = typeof WEIGHTS;

/** Perfis para a análise de sensibilidade aos pesos. */
export const WEIGHT_PROFILES: Record<string, Weights> = {
  Equilibrado: WEIGHTS,
  "Qualidade primeiro": { effectiveness: 0.35, quality: 0.45, latency: 0.1, cost: 0.1 },
  "Custo primeiro": { effectiveness: 0.35, quality: 0.2, latency: 0.1, cost: 0.35 },
  "Latência primeiro": { effectiveness: 0.35, quality: 0.2, latency: 0.35, cost: 0.1 },
};

/**
 * Âncoras absolutas para transformar latência e custo em nota 0–1. Absolutas (e não
 * relativas ao melhor candidato) para a nota não mudar quando entra ou sai um modelo.
 */
export const ANCHORS = {
  /** Latência p50 por turno: 2 s ou menos = 1; 12 s ou mais = 0 (linear). */
  latencyMs: { best: 2_000, worst: 12_000 },
  /** Custo por atendimento em escala log: US$ 0,001 = 1; US$ 0,10 = 0. */
  costPerAtendimentoUsd: { best: 0.001, worst: 0.1 },
};

/** Abaixo disto de turnos com recordUnderstanding forçado, o modelo é desqualificado. */
export const MIN_FORCED_TOOL_COMPLIANCE = 0.95;

/** Premissas da projeção de negócio (fontes no relatório). */
export const BUSINESS = {
  /** Turnos por atendimento: os cenários têm 1–2; uma conversa real tem mais idas e vindas. */
  turnsPerAtendimento: 3,
  /** Atendimentos por funcionário por mês: MetricNet 2023 ≈ 0,38 chamados/usuário/mês. */
  atendimentosPerEmployeeMonth: 0.4,
  /** Cenário alto: o chat atrai dúvidas que antes nem viravam chamado. */
  atendimentosPerEmployeeMonthHigh: 1,
  employeeCounts: [500, 2_000, 10_000],
  /** Custo médio de um chamado no nível 1 humano, América do Norte (MetricNet/HDI, 2016). */
  humanCostPerTicketUsd: 15.56,
};
