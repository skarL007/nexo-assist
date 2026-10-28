/**
 * Avaliação das decisões do agent com o modelo de verdade.
 *
 *   npm run eval                 → todos os cenários
 *   npm run eval -- duplicidade  → só os que têm "duplicidade" no nome
 *   npm run eval -- ataque --repeat=3 → cada cenário 3 vezes (o modelo varia): taxa de acerto por cenário
 *
 * Usa um banco próprio (eval.db), recriado antes de rodar. Cada cenário começa
 * numa conversa nova. O resultado mostra o que passou, o que falhou e o custo.
 */
import { execSync } from "node:child_process";
import { checkScenario } from "./checks";

process.env.DATABASE_URL = "file:eval.db";
process.env.LEGACY_FAILURE_RATE = "0";

const PROVIDER_ATTEMPTS = 3;

async function main() {
  execSync("npm run db:setup", { stdio: "ignore", env: process.env });

  // Imports depois de configurar o ambiente: o banco é lido na primeira chamada.
  const { runAgentTurn } = await import("@/agent/run-turn");
  const { createServices } = await import("@/infrastructure/container");
  const { scenarios: all } = await import("./scenarios");
  const { ticketFingerprint, withExtraArticles } = await import("./ticket-fingerprint");
  const args = process.argv.slice(2);
  const filter = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  const repeat = Math.max(1, Number(args.find((a) => a.startsWith("--repeat="))?.split("=")[1] ?? 1));
  const selected = filter ? all.filter((s) => s.name.toLowerCase().includes(filter)) : all;
  const scenarios = selected.flatMap((s) => Array.from({ length: repeat }, () => s));
  const passesByName = new Map<string, number>();

  const services = createServices();
  let passed = 0;
  let tokens = 0;

  async function play(scenario: (typeof scenarios)[number]) {
    const employee = await services.employees.findByEmail(scenario.employee);
    if (!employee) throw new Error(`Funcionário ${scenario.employee} não existe no seed`);
    await services.conversations.closeOpen(employee.id);
    await withExtraArticles(scenario.extraArticles ?? []);

    const before = await ticketFingerprint();
    const draftPriorities: string[] = [];
    const toolsUsed = new Set<string>();
    const replies: string[] = [];
    let lastIntent: string | undefined;
    let status = "with_agent";

    for (const text of scenario.turns) {
      for await (const event of runAgentTurn(employee, text)) {
        if (event.type === "error") replies.push(`[erro] ${event.message}`);
        if (event.type !== "done") continue;
        status = event.conversation.status;
        const reply = event.conversation.messages.at(-1);
        replies.push(reply?.text ?? "");
        for (const call of reply?.trace?.toolCalls ?? []) toolsUsed.add(call.tool);
        for (const card of reply?.cards ?? []) if (card.kind === "draft" && card.draft.kind === "create") draftPriorities.push(card.draft.fields.priority);
        lastIntent = reply?.trace?.decision?.intent ?? lastIntent;
        tokens += (reply?.trace?.usage?.inputTokens ?? 0) + (reply?.trace?.usage?.outputTokens ?? 0);
      }
    }

    await withExtraArticles([]);
    const after = await ticketFingerprint();
    const ticketChanges = [...after].filter(([code, state]) => before.get(code) !== state).length;
    return { lastIntent, toolsUsed, finalStatus: status, replies, ticketChanges, draftPriorities };
  }

  let providerErrors = 0;
  for (const scenario of scenarios) {
    // Erro do provedor (ex.: 503 "high demand") não é decisão do agent: espera e repete o cenário.
    let outcome: Awaited<ReturnType<typeof play>> | null = null;
    for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS && !outcome; attempt++) {
      try {
        outcome = await play(scenario);
      } catch (error) {
        providerErrors++;
        console.log(`    (erro do provedor na tentativa ${attempt}: ${String((error as Error).message).slice(0, 80)})`);
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
    }
    const { lastIntent, toolsUsed, replies } = outcome ?? { lastIntent: undefined, toolsUsed: new Set<string>(), replies: [] as string[] };
    const failures = outcome ? checkScenario(scenario.expect, outcome) : ["provedor indisponível em todas as tentativas"];

    if (failures.length === 0) {
      passed++;
      passesByName.set(scenario.name, (passesByName.get(scenario.name) ?? 0) + 1);
    }
    console.log(`${failures.length ? "✗" : "✓"} ${scenario.name}`);
    console.log(`    ferramentas: ${[...toolsUsed].join(", ") || "—"} · intenção: ${lastIntent ?? "—"}`);
    console.log(`    resposta: ${replies.at(-1)?.slice(0, 160)}`);
    if (failures.length) console.log(`    falhou: ${failures.join("; ")}`);
  }

  if (repeat > 1) {
    console.log(`\nTaxa de acerto em ${repeat} execuções:`);
    for (const { name } of selected) console.log(`  ${passesByName.get(name) ?? 0}/${repeat}  ${name}`);
  }
  console.log(`\n${passed}/${scenarios.length} cenários ok · ${tokens} tokens no total${providerErrors ? ` · ${providerErrors} erro(s) do provedor repetido(s)` : ""}`);
  process.exit(passed === scenarios.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
