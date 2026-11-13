import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { buildSupportGraph, evaluateSupportRetrieval, searchSupportCorpus, type SupportDocument } from "../src/domain/support-corpus";
import { importMicrosoftSupport, sha256 } from "../src/infrastructure/support-corpus";

const folder = resolve(".support-corpus");
const destination = resolve(folder, "microsoft.json");
const [command, ...args] = process.argv.slice(2);
async function main() {
  if (command === "import") {
    const manifest = JSON.parse(await readFile("datasets/microsoft-support.json", "utf8"));
    const snapshot = await importMicrosoftSupport(manifest);
    await mkdir(folder, { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot, null, 2), { flag: "wx" });
    await rename(temporary, destination);
    console.log(JSON.stringify({ destination, documents: snapshot.documents.length, edges: snapshot.graph.edges.length, corpusSha256: snapshot.corpusSha256, modelCostUsd: 0 }, null, 2));
    return;
  }
  if (command !== "query" && command !== "eval") throw new Error('Use import, query "pergunta" ou eval caminho-dos-casos.json');
  const snapshot = JSON.parse(await readFile(destination, "utf8")) as { documents: SupportDocument[]; corpusSha256: string };
  if (sha256(JSON.stringify(snapshot.documents)) !== snapshot.corpusSha256) throw new Error("Snapshot alterado: execute a importação novamente");
  const graph = buildSupportGraph(snapshot.documents);
  if (command === "query") {
    const query = args.join(" ").trim();
    if (!query) throw new Error("Informe a pergunta");
    console.log(JSON.stringify({ query, corpusSha256: snapshot.corpusSha256, baseline: searchSupportCorpus(snapshot.documents, graph, query, { graph: false, k: 3 }), graph: searchSupportCorpus(snapshot.documents, graph, query, { graph: true, k: 3 }) }, null, 2));
    return;
  }
  const raw = await readFile(resolve(args[0] ?? ""), "utf8");
  const evaluation = z.object({
    purpose: z.enum(["development", "holdout"]), reviewer: z.string().min(1),
    corpusSha256: z.string().length(64), k: z.number().int().min(1).max(100),
    cases: z.array(z.object({ id: z.string().min(1), query: z.string().min(1), relevantIds: z.array(z.string()) })).min(1),
  }).parse(JSON.parse(raw));
  if (evaluation.corpusSha256 !== snapshot.corpusSha256) throw new Error("Casos pertencem a outro snapshot");
  const report = { evaluatedAt: new Date().toISOString(), purpose: evaluation.purpose, reviewer: evaluation.reviewer, corpusSha256: snapshot.corpusSha256, casesSha256: sha256(raw), modelCostUsd: 0, ...evaluateSupportRetrieval(snapshot.documents, evaluation.cases, evaluation.k) };
  const path = resolve(folder, `evaluation-${Date.now()}.json`);
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath: path, ...report }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
