/**
 * Avaliação das decisões do agent com o modelo de verdade.
 *
 *   npm run eval                 → todos os cenários
 *   npm run eval -- duplicidade  → só os que têm "duplicidade" no nome
 *
 * Usa um banco próprio (eval.db), recriado antes de rodar. Cada cenário começa
 * numa conversa nova. O resultado mostra o que passou, o que falhou e o custo.
 */
import { execSync } from "node:child_process";

process.env.DATABASE_URL = "file:eval.db";
process.env.LEGACY_FAILURE_RATE = "0";

async function main() {
  execSync("npm run db:setup", { stdio: "ignore", env: process.env });

  // Imports depois de configurar o ambiente: o banco é lido na primeira chamada.
  const { runAgentTurn } = await import("@/agent/run-turn");
  const { createServices } = await import("@/infrastructure/container");
  const { scenarios: all } = await import("./scenarios");
  const filter = process.argv[2]?.toLowerCase();
  const scenarios = filter ? all.filter((s) => s.name.toLowerCase().includes(filter)) : all;

  const services = createServices();
  let passed = 0;
  let tokens = 0;

  for (const scenario of scenarios) {
    const employee = await services.employees.findByEmail(scenario.employee);
    if (!employee) throw new Error(`Funcionário ${scenario.employee} não existe no seed`);
    await services.conversations.closeOpen(employee.id);

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
        lastIntent = reply?.trace?.decision?.intent ?? lastIntent;
        tokens += (reply?.trace?.usage?.inputTokens ?? 0) + (reply?.trace?.usage?.outputTokens ?? 0);
      }
    }

    const { expect } = scenario;
    const failures: string[] = [];
    if (expect.intent && !expect.intent.includes(lastIntent as never)) failures.push(`intenção ${lastIntent}`);
    if (expect.anyTool && !expect.anyTool.some((t) => toolsUsed.has(t))) failures.push(`esperava ${expect.anyTool.join(" ou ")}`);
    for (const tool of expect.noTool ?? []) if (toolsUsed.has(tool)) failures.push(`não devia usar ${tool}`);
    if (expect.handedOff && status === "with_agent") failures.push("não transferiu");
    for (const term of expect.replyExcludes ?? []) {
      if (replies.some((r) => r.toLowerCase().includes(term.toLowerCase()))) failures.push(`vazou "${term}"`);
    }

    if (failures.length === 0) passed++;
    console.log(`${failures.length ? "✗" : "✓"} ${scenario.name}`);
    console.log(`    ferramentas: ${[...toolsUsed].join(", ") || "—"} · intenção: ${lastIntent ?? "—"}`);
    console.log(`    resposta: ${replies.at(-1)?.slice(0, 160)}`);
    if (failures.length) console.log(`    falhou: ${failures.join("; ")}`);
  }

  console.log(`\n${passed}/${scenarios.length} cenários ok · ${tokens} tokens no total`);
  process.exit(passed === scenarios.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
