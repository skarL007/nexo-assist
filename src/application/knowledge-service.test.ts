import { describe, expect, it } from "vitest";
import type { Article } from "@/domain/knowledge";
import { KnowledgeService } from "./knowledge-service";
import type { ArticleRepository, Embedder } from "./ports";

const vpn: Article = { id: "kb-vpn", title: "VPN com erro 809", body: "Reinstale o cliente de VPN.", tags: ["vpn"] };
const wifi: Article = { id: "kb-wifi", title: "Wi-Fi corporativo", body: "Conecte na Nexo-Corp.", tags: ["wifi"] };

class FakeArticles implements ArticleRepository {
  saved: { model: string; ids: string[] }[] = [];
  store = new Map<string, { vector: number[]; contentHash: string }>();
  constructor(readonly items: Article[]) {}
  async listAll() {
    return this.items;
  }
  async embeddings() {
    return new Map(this.store);
  }
  async saveEmbeddings(model: string, items: { articleId: string; vector: number[]; contentHash: string }[]) {
    this.saved.push({ model, ids: items.map((i) => i.articleId) });
    items.forEach((i) => this.store.set(i.articleId, { vector: i.vector, contentHash: i.contentHash }));
  }
}

/** Vetor de brinquedo: [fala de acesso remoto?, fala de rede sem fio?]. */
class FakeEmbedder implements Embedder {
  readonly model = "fake";
  calls: { kind: string; count: number }[] = [];
  constructor(private readonly fail = false) {}
  async embed(texts: string[], kind: "query" | "document") {
    if (this.fail) throw new Error("503");
    this.calls.push({ kind, count: texts.length });
    return texts.map((t) => (/vpn|casa|remot/i.test(t) ? [1, 0] : [0, 1]));
  }
}

describe("busca na central com embeddings", () => {
  it("acha pelo sentido e guarda os vetores dos artigos: a segunda busca só calcula a pergunta", async () => {
    const articles = new FakeArticles([vpn, wifi]);
    const embedder = new FakeEmbedder();
    const service = new KnowledgeService(articles, embedder);

    const first = await service.search("não consigo trabalhar de casa");
    expect(first.mode).toBe("hybrid");
    expect(first.matches[0].article.id).toBe("kb-vpn");
    expect(articles.saved).toEqual([{ model: "fake", ids: ["kb-vpn", "kb-wifi"] }]);

    await service.search("acesso remoto");
    expect(embedder.calls).toEqual([
      { kind: "document", count: 2 },
      { kind: "query", count: 1 },
      { kind: "query", count: 1 },
    ]);
  });

  it("artigo editado tem o vetor recalculado (o hash do texto mudou)", async () => {
    const articles = new FakeArticles([vpn, wifi]);
    const service = new KnowledgeService(articles, new FakeEmbedder());
    await service.search("vpn");
    articles.items[1] = { ...wifi, body: "Agora a rede se chama Nexo-Wifi." };
    await service.search("vpn");
    expect(articles.saved.at(-1)?.ids).toEqual(["kb-wifi"]);
  });

  it("embeddings fora do ar: avisa e cai para palavras-chave em vez de falhar", async () => {
    const errors: unknown[] = [];
    const service = new KnowledgeService(new FakeArticles([vpn, wifi]), new FakeEmbedder(true), (e) => errors.push(e));
    const result = await service.search("vpn 809");
    expect(result.mode).toBe("keyword");
    expect(result.matches[0].article.id).toBe("kb-vpn");
    expect(errors).toHaveLength(1);
  });

  it("sem chave do Google (sem embedder), é a busca por palavras", async () => {
    const result = await new KnowledgeService(new FakeArticles([vpn, wifi]), null).search("wifi");
    expect(result).toMatchObject({ mode: "keyword", matches: [{ article: { id: "kb-wifi" }, similarity: null }] });
  });
});
