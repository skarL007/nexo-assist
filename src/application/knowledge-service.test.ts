import { describe, expect, it } from "vitest";
import type { Article } from "@/domain/knowledge";
import { articleText, KnowledgeService } from "./knowledge-service";
import type { ArticleRepository, Embedder, RelevanceJudge, RelevanceVerdict } from "./ports";
import { EmbeddingHttpError, ProviderBreaker } from "./provider-breaker";

const vpn: Article = { id: "kb-vpn", title: "VPN com erro 809", body: "Reinstale o cliente de VPN.", tags: ["vpn"] };
const wifi: Article = { id: "kb-wifi", title: "Wi-Fi corporativo", body: "Conecte na Nexo-Corp.", tags: ["wifi"] };

class FakeArticles implements ArticleRepository {
  saved: { model: string; ids: string[] }[] = [];
  stores = new Map<string, Map<string, { vector: number[]; contentHash: string }>>();
  constructor(readonly items: Article[]) {}
  async listAll() {
    return this.items;
  }
  async embeddings(model: string) {
    return new Map(this.stores.get(model));
  }
  async saveEmbeddings(model: string, items: { articleId: string; vector: number[]; contentHash: string }[]) {
    this.saved.push({ model, ids: items.map((i) => i.articleId) });
    const store = this.stores.get(model) ?? new Map();
    items.forEach((i) => store.set(i.articleId, { vector: i.vector, contentHash: i.contentHash }));
    this.stores.set(model, store);
  }
}

/** Vetor de brinquedo: [fala de acesso remoto?, fala de rede sem fio?]. Com `failure`, toda chamada falha com ele. */
class FakeEmbedder implements Embedder {
  calls: { kind: string; count: number }[] = [];
  constructor(
    readonly model = "fake",
    public failure: unknown = null,
  ) {}
  async embed(texts: string[], kind: "query" | "document") {
    this.calls.push({ kind, count: texts.length });
    if (this.failure) throw this.failure;
    return texts.map((t) => (/vpn|casa|remot/i.test(t) ? [1, 0] : [0, 1]));
  }
}

/** Relógio controlado pelo teste, para o disjuntor. */
function clock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("busca na central com embeddings", () => {
  it("acha pelo sentido e guarda os vetores dos artigos: a segunda busca só calcula a pergunta", async () => {
    const articles = new FakeArticles([vpn, wifi]);
    const embedder = new FakeEmbedder();
    const service = new KnowledgeService(articles, [embedder]);

    const first = await service.search("não consigo trabalhar de casa");
    expect(first).toMatchObject({ mode: "hybrid", model: "fake" });
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
    const service = new KnowledgeService(articles, [new FakeEmbedder()]);
    await service.search("vpn");
    articles.items[1] = { ...wifi, body: "Agora a rede se chama Nexo-Wifi." };
    await service.search("vpn");
    expect(articles.saved.at(-1)?.ids).toEqual(["kb-wifi"]);
  });

  it("embeddings fora do ar: avisa e cai para palavras-chave em vez de falhar", async () => {
    const errors: unknown[] = [];
    const service = new KnowledgeService(new FakeArticles([vpn, wifi]), [new FakeEmbedder("fake", new Error("503"))], (e) => errors.push(e));
    const result = await service.search("vpn 809");
    expect(result).toMatchObject({ mode: "keyword", model: null });
    expect(result.matches[0].article.id).toBe("kb-vpn");
    expect(errors).toHaveLength(1);
  });

  it("sem nenhuma chave de embeddings, é a busca por palavras", async () => {
    const result = await new KnowledgeService(new FakeArticles([vpn, wifi]), []).search("wifi");
    expect(result).toMatchObject({ mode: "keyword", model: null, matches: [{ article: { id: "kb-wifi" }, similarity: null }] });
  });
});

describe("provedores de embeddings em ordem, com disjuntor", () => {
  it("1º provedor fora: o 2º responde, com o próprio cache de vetores, e o erro é avisado com o modelo", async () => {
    const articles = new FakeArticles([vpn, wifi]);
    const errors: { error: unknown; model: string }[] = [];
    const openrouter = new FakeEmbedder("openrouter/google/gemini-embedding-2", new EmbeddingHttpError(503));
    const google = new FakeEmbedder("gemini-embedding-2");
    const service = new KnowledgeService(articles, [openrouter, google], (error, model) => errors.push({ error, model }));

    const result = await service.search("não consigo trabalhar de casa");
    expect(result).toMatchObject({ mode: "hybrid", model: "gemini-embedding-2" });
    expect(result.matches[0].article.id).toBe("kb-vpn");
    expect(articles.saved).toEqual([{ model: "gemini-embedding-2", ids: ["kb-vpn", "kb-wifi"] }]);
    expect(errors).toEqual([{ error: new EmbeddingHttpError(503), model: "openrouter/google/gemini-embedding-2" }]);
  });

  it("402 (sem crédito) deixa o provedor de fora por 15 min; depois ele volta a ser tentado", async () => {
    const time = clock();
    const google = new FakeEmbedder("gemini-embedding-2", new EmbeddingHttpError(402));
    const service = new KnowledgeService(new FakeArticles([vpn, wifi]), [google], () => {}, new ProviderBreaker(time.now));

    await service.search("vpn");
    expect(google.calls).toHaveLength(1);

    time.advance(14 * 60_000);
    expect(await service.search("vpn")).toMatchObject({ mode: "keyword" });
    expect(google.calls).toHaveLength(1);

    time.advance(60_000);
    google.failure = null;
    expect(await service.search("vpn")).toMatchObject({ mode: "hybrid", model: "gemini-embedding-2" });
  });

  it("timeout fica de fora só 1 min, e o próximo provedor responde nesse tempo", async () => {
    const time = clock();
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const openrouter = new FakeEmbedder("openrouter/google/gemini-embedding-2", timeout);
    const google = new FakeEmbedder("gemini-embedding-2");
    const service = new KnowledgeService(new FakeArticles([vpn, wifi]), [openrouter, google], () => {}, new ProviderBreaker(time.now));

    await service.search("vpn");
    time.advance(30_000);
    expect(await service.search("vpn")).toMatchObject({ model: "gemini-embedding-2" });
    expect(openrouter.calls).toHaveLength(1);

    time.advance(30_000);
    openrouter.failure = null;
    expect(await service.search("vpn")).toMatchObject({ model: "openrouter/google/gemini-embedding-2" });
  });

  it("todos os provedores fora: palavras-chave, com um aviso por provedor", async () => {
    const errors: string[] = [];
    const service = new KnowledgeService(
      new FakeArticles([vpn, wifi]),
      [new FakeEmbedder("a", new EmbeddingHttpError(402)), new FakeEmbedder("b", new EmbeddingHttpError(500))],
      (_error, model) => errors.push(model),
    );
    expect(await service.search("vpn 809")).toMatchObject({ mode: "keyword", matches: [{ article: { id: "kb-vpn" } }] });
    expect(errors).toEqual(["a", "b"]);
  });
});

describe("verificações de diagnóstico", () => {
  const pc: Article = {
    id: "kb-pc",
    title: "Computador não liga",
    body: "Confira a energia.",
    tags: ["energia"],
    checks: [{ id: "energia-cabo", label: "Cabo de energia encaixado", fix: "Encaixe o cabo." }],
  };

  it("o texto das verificações entra no que vira embedding; artigo sem verificação não muda (cache preservado)", () => {
    expect(articleText(pc)).toContain("Cabo de energia encaixado");
    expect(articleText(vpn)).toBe("VPN com erro 809\nvpn\nReinstale o cliente de VPN.");
  });

  it("monta o texto do chamado com as verificações da central e aponta id desconhecido", async () => {
    const service = new KnowledgeService(new FakeArticles([vpn, pc]), []);
    const { text, unknown } = await service.describeChecks([
      { checkId: "energia-cabo", result: "ok" },
      { checkId: "inventada", result: "ok" },
    ]);
    expect(text).toBe("Verificações já feitas com o funcionário:\n- Cabo de energia encaixado: em ordem");
    expect(unknown).toEqual(["inventada"]);
  });

  it("acha a verificação pelo id, com o artigo de origem; id inventado não acha", async () => {
    const service = new KnowledgeService(new FakeArticles([vpn, pc]), []);
    expect(await service.findCheck("energia-cabo")).toEqual({ articleId: "kb-pc", check: pc.checks![0] });
    expect(await service.findCheck("inventada")).toBeNull();
  });
});

describe("avaliador de relevância depois da busca", () => {
  const pc: Article = {
    id: "kb-pc",
    title: "Computador não liga",
    body: "Confira a energia.",
    tags: ["energia"],
    checks: [{ id: "energia-cabo", label: "Cabo de energia encaixado", fix: "Encaixe o cabo." }],
  };

  /** Juiz de brinquedo: devolve o veredito fixo e guarda os candidatos que recebeu. */
  class FakeJudge implements RelevanceJudge {
    readonly model = "juiz";
    seen: string[][] = [];
    constructor(public verdict: RelevanceVerdict | Error) {}
    async judge(_query: string, candidates: Article[]) {
      this.seen.push(candidates.map((c) => c.id));
      if (this.verdict instanceof Error) throw this.verdict;
      return this.verdict;
    }
  }

  const service = (judge: FakeJudge, breaker = new ProviderBreaker()) =>
    new KnowledgeService(new FakeArticles([vpn, wifi, pc]), [new FakeEmbedder()], () => {}, breaker, judge);

  it("o juiz recebe os candidatos sem margem e o que aplica volta sozinho, com as verificações", async () => {
    const judge = new FakeJudge({ applies: "kb-pc", maybe: null });
    const result = await service(judge).search("o computador não liga");
    expect(judge.seen[0]).toEqual(expect.arrayContaining(["kb-vpn", "kb-wifi", "kb-pc"]));
    expect(result).toMatchObject({ verdict: "applies", matches: [{ article: { id: "kb-pc", checks: pc.checks } }] });
    expect(result.matches).toHaveLength(1);
  });

  it("talvez volta marcado; nenhum volta vazio; id fora dos candidatos conta como nenhum", async () => {
    expect(await service(new FakeJudge({ applies: null, maybe: "kb-vpn" })).search("não conecto de casa")).toMatchObject({ verdict: "maybe", matches: [{ article: { id: "kb-vpn" } }] });
    expect(await service(new FakeJudge({ applies: null, maybe: null })).search("ventilador fazendo barulho")).toMatchObject({ verdict: "none", matches: [] });
    expect(await service(new FakeJudge({ applies: "kb-inventado", maybe: null })).search("vpn")).toMatchObject({ verdict: "none", matches: [] });
  });

  it("juiz fora do ar: vale a regra de margem de antes, e o juiz fica de fora pelo disjuntor", async () => {
    const now = 0;
    const judge = new FakeJudge(new EmbeddingHttpError(402));
    const svc = service(judge, new ProviderBreaker(() => now));
    const first = await svc.search("acesso remoto de casa");
    expect(first).toMatchObject({ verdict: null, mode: "hybrid" });
    expect(first.matches[0].article.id).toBe("kb-vpn");
    await svc.search("acesso remoto de casa");
    expect(judge.seen).toHaveLength(1);
  });
});
