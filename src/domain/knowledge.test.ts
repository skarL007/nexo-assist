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

describe("precisão da busca por palavras (02/11)", () => {
  const kb: Article[] = [
    { id: "pedir", title: "Pedir equipamento", body: "Monitor, teclado e headset novos são pedidos por requisição.", tags: ["equipamento", "monitor", "teclado", "headset", "pedir"] },
    { id: "audio", title: "Sem som ou microfone em chamada", body: "Confira o dispositivo no aplicativo.", tags: ["som", "microfone", "teams"] },
    { id: "liga", title: "Computador não liga", body: "Confira a energia.", tags: ["não liga", "energia", "tomada"] },
    { id: "celular", title: "E-mail no celular", body: "Instale o Outlook.", tags: ["email", "celular"] },
    { id: "impressora", title: "Impressora não imprime", body: "Limpe a fila.", tags: ["impressora", "fila"] },
    { id: "vpn", title: "VPN com erro 809", body: "Reinstale o cliente.", tags: ["vpn", "809"] },
  ];
  const top = (query: string) => searchArticles(kb, query)[0]?.article.id ?? null;

  it("só o objeto (monitor, notebook, teclado) não escolhe artigo: falta o sintoma ou o pedido", () => {
    expect(top("o monitor está com uma listra")).toBeNull();
    expect(top("meu teclado molhou")).toBeNull();
  });

  it("objeto com sinal de pedido vai para o artigo de pedido", () => {
    expect(top("quero um headset novo")).toBe("pedir");
    expect(top("preciso de outro monitor")).toBe("pedir");
  });

  it("defeito não vai para o artigo de pedido, mesmo com o objeto no artigo", () => {
    expect(top("o headset não pega o microfone")).toBe("audio");
    expect(top("o headset parou")).not.toBe("pedir");
  });

  it("palavra fraca sozinha ('erro', 'problema') não escolhe artigo; com termo específico, sim", () => {
    expect(top("deu erro aqui")).toBeNull();
    expect(top("erro 809")).toBe("vpn");
  });

  it("sinônimos de TI do léxico: iPhone e Android são celular; multifuncional é impressora", () => {
    expect(top("configurar email no iphone")).toBe("celular");
    expect(top("a multifuncional não imprime")).toBe("impressora");
  });

  it("tolera um erro de digitação em palavra longa, mas não em palavra curta", () => {
    expect(top("impresora travada")).toBe("impressora");
    expect(top("vpm")).toBeNull();
  });

  it("flexões com o mesmo radical batem ('imprimir', 'imprime')", () => {
    expect(top("não consigo imprimir")).toBe("impressora");
  });

  it("tag com mais de uma palavra conta pela frase inteira, com o 'não' que a tokenização jogaria fora", () => {
    const [best] = searchArticles(kb, "o computador não liga");
    expect(best.article.id).toBe("liga");
    expect(best.matchedTerms).toContain("nao liga");
    expect(searchArticles(kb, "a tomada não tem energia")[0].matchedTerms).not.toContain("nao liga");
  });
});

describe("evidência fraca (02/11, 2ª rodada)", () => {
  const kb: Article[] = [
    { id: "cabo", title: "Cabo ethernet desconectado", body: "Computador do escritório ligado por cabo e sem conexão.", tags: ["ethernet", "cabo"] },
    { id: "wifi", title: "Wi-Fi corporativo", body: "Conecte na rede Nexo-Corp.", tags: ["wifi", "sem fio", "internet"] },
    { id: "celular", title: "E-mail no celular", body: "Instale o Outlook.", tags: ["email", "celular"] },
  ];
  const top = (query: string) => searchArticles(kb, query)[0]?.article.id ?? null;

  it("uma palavra que só aparece no corpo não escolhe artigo; tag ou título, sim", () => {
    expect(top("posso levar meu cachorro para o escritório?")).toBeNull();
    expect(top("o cabo do escritório soltou")).toBe("cabo");
  });

  it("'sem fio' logo depois de um objeto descreve o objeto, não é o Wi-Fi", () => {
    expect(top("meu mouse sem fio não funciona")).toBeNull();
    expect(top("a rede sem fio caiu")).toBe("wifi");
  });

  it("'e-mails' e 'emails' são o mesmo termo 'email'", () => {
    expect(top("não chegam e-mails no meu celular")).toBe("celular");
    expect(top("emails não sincronizam")).toBe("celular");
  });
});
