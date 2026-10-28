/**
 * Eval da sugestão de resposta do analista com o modelo real.
 *
 *   npm run eval:sugestao             → cada conversa 3 vezes (o modelo varia)
 *   npm run eval:sugestao -- --repeat=5
 *
 * Usa o eval-sugestao.db (só dele), recriado com o seed; o contexto é o mesmo que o console manda
 * (relatório + últimas mensagens). Checagens em checks.ts (testadas).
 */
import { execSync } from "node:child_process";
import { checkSuggestion, type SuggestionCase } from "./checks";

process.env.DATABASE_URL = "file:eval-sugestao.db";
process.env.LEGACY_FAILURE_RATE = "0";

const CASES: SuggestionCase[] = [
  { name: "Carla: acesso de aprovação no SAP (pediu analista)", conversationId: "conv-carla", firstName: "Carla", topic: ["SAP", "aprova"] },
  { name: "Bruno: plugin de IA no Figma (agent sem segurança)", conversationId: "conv-bruno", firstName: "Bruno", topic: ["Figma", "plugin"] },
  { name: "Elisa: Wi-Fi da sala 3 caiu de novo (com o agent)", conversationId: "conv-elisa", firstName: "Elisa", topic: ["Wi-Fi", "wifi", "INC-20319", "sala 3"] },
];

async function main() {
  execSync("npm run db:setup", { stdio: "ignore", env: process.env });
  const { createServices } = await import("@/infrastructure/container");
  const { consoleDetail } = await import("@/server/views");
  const { suggestionContext } = await import("@/lib/report-text");
  const { mastraReplyWriter } = await import("@/agent/reply-writer");

  const repeat = Math.max(1, Number(process.argv.find((a) => a.startsWith("--repeat="))?.split("=")[1] ?? 3));
  const services = createServices();
  let passed = 0;
  let tokens = 0;
  const latencies: number[] = [];

  for (const testCase of CASES) {
    const context = suggestionContext(await consoleDetail(services, await services.conversations.get(testCase.conversationId)));
    let ok = 0;
    for (let i = 0; i < repeat; i++) {
      const started = Date.now();
      const { text, usage } = await mastraReplyWriter.write({ context, analystFirstName: "Rafael" });
      latencies.push(Date.now() - started);
      tokens += (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
      const failures = checkSuggestion(text, context, testCase);
      if (!failures.length) ok++;
      console.log(`${failures.length ? "✗" : "✓"} ${testCase.name}\n    "${text}"${failures.length ? `\n    falhou: ${failures.join("; ")}` : ""}`);
    }
    passed += ok;
    console.log(`  → ${ok}/${repeat}\n`);
  }

  const sorted = latencies.sort((a, b) => a - b);
  console.log(`${passed}/${CASES.length * repeat} sugestões ok · ${tokens} tokens · latência mediana ${sorted[Math.floor(sorted.length / 2)]} ms`);
  process.exit(passed === CASES.length * repeat ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
