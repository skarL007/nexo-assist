import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { importMicrosoftSupport } from "./support-corpus";

const body = "# Auth\n> [!WARNING]\nAdministrator only.\n";
const source = {
  revision: "a".repeat(40),
  articles: [{ id: "auth", title: "Authentication", sourcePath: "Teams/sign-in/auth.md", sourceUrl: "https://learn.microsoft.com/en-us/troubleshoot/microsoftteams/auth",
    products: ["Microsoft Teams"], audience: "ITPro", language: "en-US", sha256: createHash("sha256").update(body).digest("hex") }],
};

describe("importação Microsoft", () => {
  it("fixa origem e revisão, preserva texto e atribuição sem chamar IA", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body));
    const snapshot = await importMicrosoftSupport(source, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/${source.revision}/Teams/sign-in/auth.md`);
    expect(snapshot.documents[0].markdown).toBe(body);
    expect(snapshot.documents[0].license).toBe("CC-BY-4.0");
    expect(snapshot.documents[0].publisher).toBe("Microsoft");
    expect(snapshot.corpusSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejeita alteração do conteúdo, HTTP inválido e tamanho excessivo", async () => {
    await expect(importMicrosoftSupport(source, async () => new Response("changed"))).rejects.toThrow(/hash/i);
    await expect(importMicrosoftSupport(source, async () => new Response("missing", { status: 404 }))).rejects.toThrow(/404/);
    await expect(importMicrosoftSupport(source, async () => new Response("x".repeat(262145)))).rejects.toThrow(/tamanho/i);
  });
  it("rejeita revisão móvel, travessia de diretório e origem fora da Microsoft antes de acessar a rede", async () => {
    const fetcher = vi.fn();
    await expect(importMicrosoftSupport({ ...source, revision: "main" }, fetcher)).rejects.toThrow();
    for (const sourcePath of ["../secrets.md", "Teams/../secrets.md", "https://evil.example/a.md", "Teams/a%2fb.md"]) {
      await expect(importMicrosoftSupport({ ...source, articles: [{ ...source.articles[0], sourcePath }] }, fetcher)).rejects.toThrow();
    }
    await expect(importMicrosoftSupport({ ...source, articles: [{ ...source.articles[0], sourceUrl: "https://evil.example/auth" }] }, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejeita seleção duplicada e corpus parcial", async () => {
    await expect(importMicrosoftSupport({ ...source, articles: [source.articles[0], source.articles[0]] }, vi.fn())).rejects.toThrow();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(body)).mockResolvedValueOnce(new Response("missing", { status: 404 }));
    await expect(importMicrosoftSupport({ ...source, articles: [source.articles[0], { ...source.articles[0], id: "other", sourcePath: "Teams/sign-in/other.md" }] }, fetcher)).rejects.toThrow();
  });
});
