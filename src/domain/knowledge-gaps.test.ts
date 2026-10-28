import { describe, expect, it } from "vitest";
import { findKnowledgeGaps, helpCenterSearches, maskPersonalData, type HelpCenterSearch } from "./knowledge-gaps";
import type { ConversationFacts } from "./resolution";
import type { TurnTrace } from "./message";

const search = (query: string, found: boolean, escalated: boolean, example = query): HelpCenterSearch => ({ query, found, escalated, example });

describe("lacunas da central", () => {
  it("4 buscas sem artigo sobre impressora, 3 viraram chamado → um tema; buscas com artigo não entram", () => {
    const gaps = findKnowledgeGaps([
      search("impressora 3º andar não imprime", false, true),
      search("impressora andar 3 sem papel", false, true),
      search("impressora do terceiro andar offline", false, true),
      search("impressora 3 andar fila travada", false, false),
      search("vpn erro 809", true, true),
      search("vpn erro 809 windows", true, true),
      search("vpn erro 809 casa", true, false),
    ]);
    expect(gaps).toEqual([{ terms: ["impressora", "andar"], searches: 4, escalatedRate: 0.75, example: "impressora 3º andar não imprime" }]);
  });

  it("abaixo do mínimo de ocorrências (3), nada aparece", () => {
    expect(findKnowledgeGaps([search("scanner sala 2", false, true), search("scanner da sala 2", false, true)])).toEqual([]);
  });

  it("temas diferentes viram linhas diferentes, o maior primeiro", () => {
    const gaps = findKnowledgeGaps([
      ...["teams", "teams", "teams", "teams"].map((t, i) => search(`${t} sem som ${i}`, false, true)),
      ...["scanner", "scanner", "scanner"].map((t, i) => search(`${t} digitaliza ${i}`, false, false)),
    ]);
    expect(gaps.map((g) => [g.terms[0], g.searches])).toEqual([
      ["teams", 4],
      ["scanner", 3],
    ]);
  });
});

describe("dado pessoal no exemplo", () => {
  it("mascara e-mail, CPF, telefone, número de chamado e números longos", () => {
    expect(maskPersonalData("sou ana.souza@nexo.com.br, CPF 123.456.789-09, ramal (11) 98765-4321, INC-20319, matrícula 4455667")).toBe(
      "sou [e-mail], CPF [CPF], ramal [telefone], [chamado], matrícula [número]",
    );
    expect(maskPersonalData("cpf 12345678909 e REQ-1")).toBe("cpf [CPF] e [chamado]");
  });
});

describe("buscas a partir dos traces", () => {
  const trace = (query: string, articles: number): TurnTrace => ({
    decision: null,
    steps: [],
    toolCalls: [{ tool: "searchHelpCenter", input: { query }, output: { articles: Array.from({ length: articles }, () => ({})) }, durationMs: 5 }],
    guardrails: [],
    model: "google/gemini-3.5-flash",
    usage: null,
    latencyMs: 100,
  });
  const facts: ConversationFacts = {
    id: "c1",
    employeeId: "ana",
    feedback: [],
    drafts: ["confirmed"],
    messages: [
      { id: "m1", role: "employee", text: "a impressora do 3º andar parou, meu e-mail é ana@nexo.com.br", cards: [], trace: null, createdAt: "2026-10-20T13:00:00.000Z" },
      { id: "m2", role: "agent", text: "…", cards: [], trace: trace("impressora 3 andar", 0), createdAt: "2026-10-20T13:00:01.000Z" },
    ],
  };

  it("pega a consulta, se achou artigo, se a conversa escalou e a fala (mascarada) do funcionário", () => {
    expect(helpCenterSearches([facts], new Map([["c1", "ticket"]]))).toEqual([
      { query: "impressora 3 andar", found: false, escalated: true, example: "a impressora do 3º andar parou, meu e-mail é [e-mail]" },
    ]);
  });
});
