import { describe, expect, it } from "vitest";
import { searchArticles, tokenize, type Article } from "./knowledge";

const articles: Article[] = [
  { id: "vpn-809", title: "VPN com erro 809", body: "Reinstale o cliente de VPN.", tags: ["vpn", "809"] },
  { id: "horario", title: "Horário do service desk", body: "Segunda a sexta, das 8h às 18h.", tags: ["horário"] },
];

describe("tokenize", () => {
  it("remove acentos, pontuação e palavras vazias", () => {
    expect(tokenize("Não consigo conectar na VPN!")).toEqual(["consigo", "conectar", "vpn"]);
  });
});

describe("searchArticles", () => {
  it("encontra o artigo pelo código do erro", () => {
    const [best] = searchArticles(articles, "minha vpn dá erro 809");
    expect(best.article.id).toBe("vpn-809");
    expect(best.matchedTerms).toContain("809");
  });

  it("ignora acentos na busca", () => {
    expect(searchArticles(articles, "qual o horario?")[0].article.id).toBe("horario");
  });

  it("não retorna nada quando nenhuma palavra bate", () => {
    expect(searchArticles(articles, "férias no RH")).toEqual([]);
  });
});
