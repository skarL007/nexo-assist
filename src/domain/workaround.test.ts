import { describe, expect, it } from "vitest";
import type { Card } from "./message";
import { classifyPriority } from "./priority";
import { countAgentQuestions, decideWorkaround, MAX_INTAKE_QUESTIONS, mentionsWorkaround, WORKAROUND_OPTIONS } from "./workaround";

type Msg = { role: "employee" | "agent"; text: string; cards: Card[] };
const employee = (text: string): Msg => ({ role: "employee", text, cards: [] });
const agent = (text: string, options?: string[]): Msg => ({ role: "agent", text, cards: options ? [{ kind: "quick_replies", options }] : [] });

// outlook-direto #2 (28/10): problema, quem é afetado e "Sem urgência", sem nada sobre alternativa.
const outlook: Msg[] = [
  employee("o outlook nao abre desde ontem"),
  agent("Entendi. Isso afeta só você ou mais pessoas?", ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"]),
  employee("Só eu"),
];
const incNone = { type: "INC", urgency: "none" } as const;

describe("decideWorkaround: perguntar se há alternativa antes da prioridade", () => {
  it("INC sem urgência, sem nada sobre alternativa e com 1 pergunta feita → pergunta, com os botões", () => {
    expect(decideWorkaround(incNone, outlook)).toEqual({ action: "ask", options: [...WORKAROUND_OPTIONS] });
    expect(WORKAROUND_OPTIONS).toEqual(["Tenho alternativa", "Não tenho alternativa"]);
  });

  it('depois de "Tenho alternativa" nos botões → corrige para há alternativa (Média, não Baixa)', () => {
    const history = [...outlook, agent("Você tem outro jeito de trabalhar enquanto isso?", [...WORKAROUND_OPTIONS]), employee("Tenho alternativa")];
    const decision = decideWorkaround(incNone, history);
    expect(decision).toEqual({ action: "draft", urgency: "has_workaround", corrected: true });
    if (decision.action === "draft") expect(classifyPriority("me", decision.urgency).priority).toBe("medium");
  });

  it('"Não tenho alternativa" mantém a urgência que o modelo mandou', () => {
    const history = [...outlook, agent("Você tem outro jeito de trabalhar enquanto isso?", [...WORKAROUND_OPTIONS]), employee("Não tenho alternativa")];
    expect(decideWorkaround(incNone, history)).toEqual({ action: "draft", urgency: "none", corrected: false });
  });

  it("REQ sem urgência não pergunta: num pedido, sem urgência é o normal", () => {
    expect(decideWorkaround({ type: "REQ", urgency: "none" }, outlook)).toEqual({ action: "draft", urgency: "none", corrected: false });
  });

  it("urgência já informada não pergunta: a resposta não mudaria a prioridade", () => {
    for (const urgency of ["blocked", "deadline_today", "has_workaround"] as const) {
      expect(decideWorkaround({ type: "INC", urgency }, outlook)).toEqual({ action: "draft", urgency, corrected: false });
    }
  });

  it("alternativa já mencionada pelo funcionário não pergunta", () => {
    const history = [...outlook, employee("o webmail funciona, então dá para trabalhar")];
    expect(decideWorkaround(incNone, history).action).toBe("draft");
  });

  it("o agent já perguntou sobre alternativa (com outras palavras) → não pergunta de novo", () => {
    const history = [...outlook, agent("Tem alguma alternativa para trabalhar enquanto isso?"), employee("sem urgência")];
    expect(decideWorkaround(incNone, history).action).toBe("draft");
  });

  it(`com ${MAX_INTAKE_QUESTIONS} perguntas já feitas → não pergunta (limite de perguntas)`, () => {
    const history = [
      employee("nada funciona aqui!!"),
      agent("O que exatamente não está funcionando?"),
      employee("o outlook"),
      agent("Afeta só você?", ["Só eu", "Minha equipe"]),
      employee("Só eu"),
      agent("Como isso afeta suas atividades hoje?", ["Impede de trabalhar", "Sem urgência"]),
      employee("Sem urgência"),
    ];
    expect(MAX_INTAKE_QUESTIONS).toBe(3);
    expect(decideWorkaround(incNone, history)).toEqual({ action: "draft", urgency: "none", corrected: false });
  });
});

describe("mentionsWorkaround", () => {
  it("reconhece quem já disse se consegue trabalhar ou não", () => {
    for (const text of ["uso o webmail enquanto isso", "dá pra usar a impressora do 2º andar", "Não tenho alternativa", "estou parada, não consigo trabalhar", "consigo trabalhar pelo celular"]) {
      expect(mentionsWorkaround(text), text).toBe(true);
    }
  });

  it("não confunde com a descrição do problema", () => {
    for (const text of ["o outlook nao abre desde ontem", "Só eu", "Sem urgência", "abre uma janela de erro e fecha"]) {
      expect(mentionsWorkaround(text), text).toBe(false);
    }
  });
});

describe("countAgentQuestions", () => {
  it("conta respostas do agent que terminam em ? ou mostram respostas rápidas", () => {
    expect(countAgentQuestions([employee("oi?"), agent("Pode me dizer qual sistema?"), agent("Escolha uma opção.", ["A", "B"]), agent("Pronto, abri o INC-1.")])).toBe(2);
  });
});
