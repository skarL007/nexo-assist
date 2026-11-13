import { createHash } from "node:crypto";
import { z } from "zod";
import { buildSupportGraph, type SupportDocument } from "../domain/support-corpus";

const MAX_BYTES = 256 * 1024;
const articleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1),
  sourcePath: z.string().regex(/^(?:[A-Za-z0-9_-]+\/)+[A-Za-z0-9_-]+\.md$/),
  sourceUrl: z.url().refine(value => { const u = new URL(value); return u.origin === "https://learn.microsoft.com" && u.pathname.startsWith("/en-us/troubleshoot/") && !u.username && !u.password; }),
  products: z.array(z.string().min(1)).min(1), audience: z.literal("ITPro"), language: z.literal("en-US"), sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const supportManifestSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{40}$/), articles: z.array(articleSchema).min(1).max(100) });
export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

export async function importMicrosoftSupport(input: unknown, fetcher: typeof fetch = fetch) {
  const manifest = supportManifestSchema.parse(input);
  if (new Set(manifest.articles.map(a => a.id)).size !== manifest.articles.length || new Set(manifest.articles.map(a => a.sourcePath)).size !== manifest.articles.length) throw new Error("Seleção duplicada");
  const documents: SupportDocument[] = [];
  let total = 0;
  for (const article of manifest.articles) {
    const downloadUrl = `https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/${manifest.revision}/${article.sourcePath}`;
    const response = await fetcher(downloadUrl, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${article.id}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        total += value.byteLength;
        if (size > MAX_BYTES || total > 10 * 1024 * 1024) throw new Error("Tamanho do corpus excedido");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = Buffer.concat(chunks);
    if (sha256(bytes) !== article.sha256) throw new Error(`Hash divergente: ${article.id}`);
    documents.push({ ...article, markdown: bytes.toString("utf8"), revision: manifest.revision, downloadUrl, publisher: "Microsoft", license: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" });
  }
  return { schemaVersion: 1, retrievedAt: new Date().toISOString(), corpusSha256: sha256(JSON.stringify(documents)), documents, graph: buildSupportGraph(documents) };
}
