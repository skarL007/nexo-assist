import { describe, expect, it } from "vitest";
import { CHECK_OPTIONS, checksAsked, checksFromHistory, describeChecksDone } from "./diagnostics";
import type { Article } from "./knowledge";

const articles: Article[] = [
  {
    id: "kb-pc-nao-liga",
    title: "Computador ou notebook não liga",
    body: "Confira a energia antes de abrir chamado.",
    tags: ["não liga"],
    checks: [
      { id: "energia-cabo", label: "Cabo de energia encaixado no computador e na tomada", fix: "Encaixe o cabo nas duas pontas." },
      { id: "energia-tomada", label: "Tomada funcionando (testada com outro aparelho)", fix: "Use outra tomada." },
    ],
  },
  { id: "kb-horario", title: "Horário do service desk", body: "Das 8h às 18h.", tags: ["horário"] },
];

describe("describeChecksDone", () => {
  it("monta as linhas com o texto do artigo, não com o que o modelo escreveu", () => {
    const { text, unknown } = describeChecksDone(articles, [
      { checkId: "energia-cabo", result: "ok" },
      { checkId: "energia-tomada", result: "adjusted" },
    ]);
    expect(text).toBe(
      "Verificações já feitas com o funcionário:\n" +
        "- Cabo de energia encaixado no computador e na tomada: em ordem\n" +
        "- Tomada funcionando (testada com outro aparelho): ajustado, sem resolver",
    );
    expect(unknown).toEqual([]);
  });

  it("descarta id que não existe na central e lista para o trace", () => {
    const { text, unknown } = describeChecksDone(articles, [
      { checkId: "energia-cabo", result: "not_done" },
      { checkId: "trocou-a-fonte", result: "ok" },
    ]);
    expect(text).toBe("Verificações já feitas com o funcionário:\n- Cabo de energia encaixado no computador e na tomada: não conseguiu verificar");
    expect(unknown).toEqual(["trocou-a-fonte"]);
  });

  it("repetição do mesmo id conta uma vez, com o último resultado", () => {
    const { text } = describeChecksDone(articles, [
      { checkId: "energia-cabo", result: "not_done" },
      { checkId: "energia-cabo", result: "ok" },
    ]);
    expect(text).toBe("Verificações já feitas com o funcionário:\n- Cabo de energia encaixado no computador e na tomada: em ordem");
  });

  it("sem verificação válida não há texto", () => {
    expect(describeChecksDone(articles, []).text).toBeNull();
    expect(describeChecksDone(articles, [{ checkId: "inventada", result: "ok" }]).text).toBeNull();
  });
});

const ask = (checkId: string) => ({ role: "agent", text: "Pode conferir?", trace: { toolCalls: [{ tool: "askDiagnosticCheck", input: { checkId } }] } });
const said = (text: string) => ({ role: "employee", text, trace: null });

describe("checksFromHistory", () => {
  it("cada verificação pedida vira o resultado do botão que a pessoa clicou em seguida", () => {
    const history = [
      said("Meu computador não liga"),
      ask("energia-cabo"),
      said("Já estava assim"),
      ask("energia-tomada"),
      said("ajustei, mas continua"),
      ask("energia-chave-fonte"),
      said("Não consigo verificar"),
    ];
    expect(checksFromHistory(history)).toEqual([
      { checkId: "energia-cabo", result: "ok" },
      { checkId: "energia-tomada", result: "adjusted" },
      { checkId: "energia-chave-fonte", result: "not_done" },
    ]);
  });

  it("resposta livre, \"Resolveu\" ou verificação ainda sem resposta não entram", () => {
    const history = [ask("energia-cabo"), said("onde fica isso?"), ask("energia-tomada"), said("Resolveu"), ask("energia-chave-fonte")];
    expect(checksFromHistory(history)).toEqual([]);
  });

  it("conta quantas verificações já foram pedidas (o limite é de código)", () => {
    expect(checksAsked([ask("a"), said("Já estava assim"), ask("b"), said("x"), { role: "agent", text: "ok", trace: null }])).toBe(2);
  });

  it("os botões são os quatro resultados possíveis", () => {
    expect(CHECK_OPTIONS).toEqual(["Já estava assim", "Ajustei, mas continua", "Resolveu", "Não consigo verificar"]);
  });
});
