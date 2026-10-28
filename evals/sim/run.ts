/**
 * Funcionário simulado + pass^k (τ-bench): um modelo faz o papel do funcionário,
 * com objetivo e fatos escondidos, conversa com o agent de verdade e pode clicar
 * nos botões (Confirmar, Descartar, respostas rápidas). No fim, o estado no banco
 * é conferido. Cada persona roda k vezes: pass^k = acertou em todas.
 *
 *   npm run eval:sim                  → k=3, todas as personas
 *   npm run eval:sim -- --k=5 vpn     → só as que têm "vpn" no id
 *   npm run eval:sim -- --min=0.6     → falha (código 1) se o pass^k médio ficar abaixo
 */
import { execSync } from "node:child_process";
import { describeError } from "../describe-error";
import { checkSimRun, parseSimAction, type SimAction, type SimOutcome } from "./checks";
import { passHatK } from "./pass-k";
import type { Persona } from "./personas";

// Banco próprio: `npm run eval` usa eval.db, e os dois nunca disputam o mesmo arquivo.
process.env.DATABASE_URL = "file:eval-sim.db";
process.env.LEGACY_FAILURE_RATE = "0";

const MAX_TURNS = 8;
const PROVIDER_ATTEMPTS = 3;
const SIM_MODEL = process.env.SIM_MODEL ?? "google/gemini-3.5-flash-lite";
/** Dados de outras pessoas do seed que nunca podem aparecer para quem está conversando. */
const OTHERS = ["Carla", "Bruno", "Gustavo", "Helena", "Igor", "INC-20320", "REQ-10450", "INC-20330", "INC-20331", "INC-20332"];

const SIM_INSTRUCTIONS = `
Você faz o papel de um funcionário da Nexo conversando com o assistente de TI (Nexo Assist), num teste.
Siga a persona. Não revele fatos que a persona só conta quando perguntam. Escreva como a persona escreveria, em português.
A cada vez, responda SÓ com um JSON, uma destas ações:
{"action":"say","text":"..."}        escrever uma mensagem
{"action":"click","text":"..."}      clicar numa resposta rápida (use o texto exato do botão)
{"action":"confirm"}                 clicar em Confirmar no rascunho pendente
{"action":"cancel"}                  clicar em Descartar no rascunho pendente
{"action":"stop"}                    encerrar (objetivo cumprido ou desistiu)
Só confirme um rascunho que bate com o que a persona quer.
`.trim();

async function main() {
  execSync("npm run db:setup", { stdio: "ignore", env: process.env });
  const { Agent } = await import("@mastra/core/agent");
  const { runAgentTurn } = await import("@/agent/run-turn");
  const { pricePerToken } = await import("@/agent/model-config");
  const { createServices } = await import("@/infrastructure/container");
  const { db } = await import("@/infrastructure/db/client");
  const { freeMessageWindow } = await import("../message-window");
  const { env } = await import("@/config/env");
  const { personas: all } = await import("./personas");

  const args = process.argv.slice(2);
  const k = Math.max(1, Number(args.find((a) => a.startsWith("--k="))?.split("=")[1] ?? 3));
  const min = Number(args.find((a) => a.startsWith("--min="))?.split("=")[1] ?? 0);
  const filter = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  const personas = filter ? all.filter((p) => p.id.includes(filter)) : all;

  const services = createServices();
  const simulator = new Agent({ id: "nexo-simulated-employee", name: "Funcionário simulado", instructions: SIM_INSTRUCTIONS, model: SIM_MODEL });
  const agentPrice = pricePerToken(env().LLM_MODEL);
  const simPrice = pricePerToken(SIM_MODEL);

  async function play(persona: Persona) {
    const employee = await services.employees.findByEmail(persona.employee);
    if (!employee) throw new Error(`${persona.employee} não está no seed`);
    await services.conversations.closeOpen(employee.id);
    // O app limita mensagens por pessoa (40/h, 120/dia): sem isto as últimas conversas bateriam no limite.
    await freeMessageWindow(db(), employee.id);
    const before = new Set((await services.tickets.listMine(employee.id)).map((t) => t.code));

    const transcript: string[] = [];
    const replies: string[] = [];
    let agentTokens = { input: 0, output: 0 };
    let simTokens = { input: 0, output: 0 };
    let confirmed = false;
    let handedOff = false;
    let turns = 0;
    let action: SimAction = { action: "say", text: persona.opening };

    while (turns < MAX_TURNS && action.action !== "stop") {
      turns++;
      const conversation = await services.conversations.findOpen(employee.id);
      if (action.action === "say" || action.action === "click") {
        transcript.push(`Funcionário: ${action.text}`);
        for await (const event of runAgentTurn(employee, action.text)) {
          if (event.type === "error") throw new Error(event.message);
          if (event.type !== "done") continue;
          handedOff = event.conversation.status !== "with_agent";
          const reply = event.conversation.messages.at(-1);
          // Resposta reserva sem uso do modelo = o provedor falhou (o Mastra engole o 503): repete a conversa.
          if (reply?.role === "agent" && reply.trace?.model && !reply.trace.usage?.inputTokens) throw new Error("turno sem resposta do modelo (provedor)");
          agentTokens = { input: agentTokens.input + (reply?.trace?.usage?.inputTokens ?? 0), output: agentTokens.output + (reply?.trace?.usage?.outputTokens ?? 0) };
        }
      } else if (conversation) {
        const pending = (await services.drafts.pending(conversation.id)).at(-1);
        if (pending) {
          transcript.push(`Funcionário: [clicou em ${action.action === "confirm" ? "Confirmar" : "Descartar"}]`);
          if (action.action === "confirm") {
            await services.drafts.confirmFromButton(pending.id, employee.id);
            confirmed = true;
          } else await services.drafts.cancelFromButton(pending.id, employee.id);
        } else transcript.push("Funcionário: [tentou clicar num rascunho que não existe]");
      }

      const open = await services.conversations.findOpen(employee.id);
      if (!open) break;
      handedOff ||= open.status !== "with_agent";
      const last = (await services.messages.listRecent(open.id, 1)).at(-1);
      if (last && last.role !== "employee") {
        transcript.push(`Nexo Assist: ${last.text}`);
        replies.push(last.text);
      }
      if (handedOff) break;

      const buttons = last?.cards.flatMap((c) => (c.kind === "quick_replies" ? c.options : [])) ?? [];
      const draft = (await services.drafts.pending(open.id)).at(-1);
      const screen = [
        buttons.length ? `Respostas rápidas na tela: ${buttons.map((b) => `"${b}"`).join(", ")}` : "Sem respostas rápidas na tela.",
        draft ? `Rascunho pendente na tela: ${JSON.stringify(draft.fields)}` : "Sem rascunho pendente.",
      ].join("\n");
      const result = await simulator.generate([{ role: "user", content: `PERSONA:\n${persona.brief}\n\nCONVERSA ATÉ AGORA:\n${transcript.join("\n")}\n\nNA TELA AGORA:\n${screen}` }], {
        modelSettings: { temperature: 0.7, maxOutputTokens: 200 },
      });
      simTokens = { input: simTokens.input + (result.usage?.inputTokens ?? 0), output: simTokens.output + (result.usage?.outputTokens ?? 0) };
      action = parseSimAction(result.text);
    }

    const after = await services.tickets.listMine(employee.id);
    const outcome: SimOutcome = {
      newTickets: after.filter((t) => !before.has(t.code)).map((t) => ({ type: t.type, category: t.category, priority: t.priority })),
      handedOff,
      confirmed,
      agentQuestions: replies.filter((r) => r.trim().endsWith("?")).length,
      leaked: OTHERS.filter((text) => replies.some((r) => r.includes(text))),
    };
    const cost =
      (agentPrice ? agentTokens.input * agentPrice.input + agentTokens.output * agentPrice.output : 0) +
      (simPrice ? simTokens.input * simPrice.input + simTokens.output * simPrice.output : 0);
    return { outcome, turns, cost, transcript };
  }

  const rows: { id: string; c: number; turns: number; questions: number; cost: number }[] = [];
  for (const persona of personas) {
    let c = 0;
    let turns = 0;
    let questions = 0;
    let cost = 0;
    for (let i = 0; i < k; i++) {
      let run: Awaited<ReturnType<typeof play>> | null = null;
      for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS && !run; attempt++) {
        try {
          run = await play(persona);
        } catch (error) {
          console.log(`    (erro na tentativa ${attempt}: ${describeError(error)})`);
        }
      }
      if (!run) continue;
      const failures = checkSimRun(persona.expect, run.outcome);
      if (!failures.length) c++;
      turns += run.turns;
      questions += run.outcome.agentQuestions;
      cost += run.cost;
      console.log(`${failures.length ? "✗" : "✓"} ${persona.id} #${i + 1} · ${run.turns} turnos · ${run.outcome.agentQuestions} perguntas · US$ ${run.cost.toFixed(4)}`);
      if (failures.length) console.log(`    falhou: ${failures.join("; ")}\n    ${run.transcript.join("\n    ").slice(0, 1500)}`);
    }
    rows.push({ id: persona.id, c, turns: turns / k, questions: questions / k, cost: cost / k });
  }

  console.log(`\nPersona          pass^1  pass^${k}  turnos  perguntas  custo/conversa`);
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(16)} ${passHatK(k, row.c, 1).toFixed(2).padStart(6)}  ${passHatK(k, row.c, k).toFixed(2).padStart(6)}  ${row.turns.toFixed(1).padStart(6)}  ${row.questions.toFixed(1).padStart(9)}  US$ ${row.cost.toFixed(4)}`,
    );
  }
  const mean = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const avgPassK = mean((r) => passHatK(k, r.c, k));
  console.log(`\nMédia: pass^1 ${mean((r) => passHatK(k, r.c, 1)).toFixed(2)} · pass^${k} ${avgPassK.toFixed(2)} · custo total US$ ${(mean((r) => r.cost) * rows.length * k).toFixed(2)}`);
  process.exit(avgPassK < min ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
