/**
 * Funcionário simulado + pass^k (τ-bench): um modelo faz o papel do funcionário,
 * com objetivo e fatos escondidos, conversa com o agent de verdade e pode clicar
 * nos botões (Confirmar, Descartar, respostas rápidas). No fim, o estado no banco
 * é conferido. Cada persona roda k vezes: pass^k = acertou em todas.
 *
 *   npm run eval:sim                  → k=3, todas as personas
 *   npm run eval:sim -- --k=5 vpn     → só as que têm "vpn" no id
 *   npm run eval:sim -- --min=0.6     → falha (código 1) se o pass^k médio ficar abaixo
 *   npm run eval:sim -- --sem-geval   → sem o juiz G-Eval (só o estado do banco e a telemetria)
 *
 * Benchmark de personas (02/11): cada conversa guarda a telemetria dos turnos (a mesma do console
 * do analista: buscas, vereditos, degradação, ferramentas, latência, tokens, regras, modelo reserva)
 * e recebe a G-Eval (critérios com notas 1–5 por logprobs, passos congelados em
 * evals/benchmark/results/passos-geval.json). Portões em telemetry.ts: sucesso ≥ 95% no total e por
 * estilo, G-Eval ≥ 4,5 por critério, com IC de Wilson. Relatório: docs/validacao/BENCHMARK-PERSONAS.md.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { TurnTrace } from "@/domain/message";
import { JUDGES } from "../benchmark/config";
import { judgeTranscript } from "../benchmark/judges";
import { assertModelResponded, retryOnProviderError } from "../provider-errors";
import { ANALYST_INVITE, checkSimRun, LOOKS_LIKE_CONFIRMATION, parseSimAction, type SimAction, type SimOutcome } from "./checks";
import { passHatK } from "./pass-k";
import type { Persona } from "./personas";
import { evaluateGates, GATES, summarizeTelemetry, type PersonaRun, type TelemetrySummary } from "./telemetry";

// Banco próprio: `npm run eval` usa eval.db, e os dois nunca disputam o mesmo arquivo.
process.env.DATABASE_URL = "file:eval-sim.db";
process.env.LEGACY_FAILURE_RATE = "0";
// Gasto acumulado entre execuções e dias fora do banco (que cada eval recria): mesmo teto do .env.
process.env.SPEND_LEDGER_FILE ??= "evals/.gasto-llm.json";

const MAX_TURNS = 8;
const PROVIDER_ATTEMPTS = 3;
// DeepInfra quando há a chave (02/11); senão OpenRouter. O Gemini direto ficou sem crédito em 30/10 (402).
const SIM_MODEL = process.env.SIM_MODEL ?? (process.env.DEEPINFRA_API_KEY ? "deepinfra/deepseek-ai/DeepSeek-V4-Flash" : "openrouter/google/gemini-3.5-flash-lite");
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
  const { resetSimState } = await import("./reset");
  const { env } = await import("@/config/env");
  const { personas: all } = await import("./personas");
  const { parseNeededBy } = await import("@/domain/sla-need");

  const args = process.argv.slice(2);
  const k = Math.max(1, Number(args.find((a) => a.startsWith("--k="))?.split("=")[1] ?? 3));
  const min = Number(args.find((a) => a.startsWith("--min="))?.split("=")[1] ?? 0);
  const filter = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  const personas = filter ? all.filter((p) => p.id.includes(filter)) : all;

  const services = createServices();
  const simulator = new Agent({ id: "nexo-simulated-employee", name: "Funcionário simulado", instructions: SIM_INSTRUCTIONS, model: SIM_MODEL });
  const agentPrice = pricePerToken(env().LLM_MODEL);
  const simPrice = pricePerToken(SIM_MODEL) ?? pricePerToken(SIM_MODEL.replace(/^openrouter\//, ""));
  const withGeval = !process.argv.includes("--sem-geval");
  const judgeKey = process.argv.find((a) => a.startsWith("--juiz="))?.split("=")[1] ?? JUDGES[0].key;
  const judge = withGeval ? JUDGES.find((j) => j.key === judgeKey) : undefined;
  if (withGeval && !judge) throw new Error(`Juiz desconhecido; use um de: ${JUDGES.map((j) => j.key).join(", ")}`);
  const gevalSteps = withGeval ? (JSON.parse(readFileSync("evals/benchmark/results/passos-geval.json", "utf8")) as { steps: Record<string, string> }).steps : null;

  async function play(persona: Persona) {
    // Toda execução parte do seed (pass^k = k tentativas da mesma tarefa): sem isto, o chamado
    // aberto na execução anterior vira "duplicado" na seguinte. Também zera a janela de mensagens.
    await resetSimState(db());
    const employee = await services.employees.findByEmail(persona.employee);
    if (!employee) throw new Error(`${persona.employee} não está no seed`);
    await services.conversations.closeOpen(employee.id);
    const runStart = new Date();
    const fingerprint = (t: { status: string; updatedAt: Date }) => `${t.status}|${t.updatedAt.toISOString()}`;
    const seeded = new Map((await services.tickets.listMine(employee.id)).map((t) => [t.code, fingerprint(t)]));
    const before = new Set(seeded.keys());
    const ticketCount = async () => (await services.tickets.listMine(employee.id)).length;
    const unconfirmedCreations: string[] = [];
    let analystOffered = false;
    let lastDraftDeadline: string | null = null;

    const transcript: string[] = [];
    const replies: string[] = [];
    let agentTokens = { input: 0, output: 0 };
    let simTokens = { input: 0, output: 0 };
    let confirmed = false;
    let handedOff = false;
    let turns = 0;
    const traces: TurnTrace[] = [];
    let action: SimAction = { action: "say", text: persona.opening };

    while (turns < MAX_TURNS && action.action !== "stop") {
      turns++;
      const conversation = await services.conversations.findOpen(employee.id);
      if (action.action === "say" || action.action === "click") {
        transcript.push(`Funcionário: ${action.text}`);
        const ticketsBefore = await ticketCount();
        for await (const event of runAgentTurn(employee, action.text)) {
          if (event.type === "error") throw new Error(event.message);
          if (event.type !== "done") continue;
          handedOff = event.conversation.status !== "with_agent";
          const reply = event.conversation.messages.at(-1);
          // Resposta reserva sem uso do modelo = o provedor falhou (o Mastra engole o 503): repete a conversa.
          assertModelResponded(reply);
          if (reply?.trace) traces.push(reply.trace);
          agentTokens = { input: agentTokens.input + (reply?.trace?.usage?.inputTokens ?? 0), output: agentTokens.output + (reply?.trace?.usage?.outputTokens ?? 0) };
        }
        // Chamado nascido no turno de uma mensagem ou clique que não confirma: o agent abriu sem confirmação.
        // Confirmação por texto explícito ("Sim, pode criar") também é confirmação, não só o botão.
        if ((await ticketCount()) > ticketsBefore) {
          if (LOOKS_LIKE_CONFIRMATION.test(action.text)) confirmed = true;
          else unconfirmedCreations.push(action.text);
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
        const offeredButton = last.cards.some((c) => c.kind === "quick_replies" && c.options.some((o) => /analista/i.test(o)));
        analystOffered ||= offeredButton || ANALYST_INVITE.test(last.text);
      }
      if (handedOff) break;

      const buttons = last?.cards.flatMap((c) => (c.kind === "quick_replies" ? c.options : [])) ?? [];
      const draft = (await services.drafts.pending(open.id)).at(-1);
      if (draft?.kind === "create" && draft.deadline) lastDraftDeadline = draft.deadline;
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
    const created = after.filter((t) => !before.has(t.code));
    const need = persona.expect.neededBy ? parseNeededBy(persona.expect.neededBy, runStart) : null;
    // Sem chamado criado (ex.: clicou em analista antes de confirmar), vale o prazo do último rascunho mostrado.
    const deadline = created[0] ? services.tickets.snapshot(created[0]).deadline : lastDraftDeadline;
    const outcome: SimOutcome = {
      newTickets: created.map((t) => ({ type: t.type, category: t.category, priority: t.priority })),
      changedExisting: after.filter((t) => seeded.has(t.code) && seeded.get(t.code) !== fingerprint(t)).map((t) => t.code),
      unconfirmedCreations,
      analystOffered,
      slaMissesNeed: need && deadline ? new Date(deadline) > need : undefined,
      handedOff,
      confirmed,
      agentQuestions: replies.filter((r) => r.trim().endsWith("?")).length,
      leaked: OTHERS.filter((text) => replies.some((r) => r.includes(text))),
    };
    // O custo do agent já entra no livro-caixa pelo turno; aqui entra o do funcionário simulado.
    const simCost = simPrice ? simTokens.input * simPrice.input + simTokens.output * simPrice.output : 0;
    await services.spend.record(simCost);
    const cost = (agentPrice ? agentTokens.input * agentPrice.input + agentTokens.output * agentPrice.output : 0) + simCost;
    return { outcome, turns, cost, transcript, traces };
  }

  const rows: BenchmarkRow[] = [];
  const benchmarkRuns: PersonaRun[] = [];
  let judgeCost = 0;
  for (const persona of personas) {
    let c = 0;
    let turns = 0;
    let questions = 0;
    let cost = 0;
    const personaTraces: TurnTrace[] = [];
    const personaScores: Record<string, number>[] = [];
    for (let i = 0; i < k; i++) {
      // Teto de gasto (LLM_DAILY_BUDGET_USD / LLM_TOTAL_BUDGET_USD): para antes da conversa, não no meio.
      await services.spend.assertCanSpend();
      // Só falha do provedor repete a conversa; regra do app (message_limit), banco ou harness param a execução.
      const { value: run } = await retryOnProviderError(() => play(persona), {
        label: `${persona.id} #${i + 1}`,
        attempts: PROVIDER_ATTEMPTS,
        waitMs: () => 0,
        log: (line) => console.log(`    ${line}`),
      });
      if (!run) continue;
      const failures = checkSimRun(persona.expect, run.outcome);
      if (!failures.length) c++;
      personaTraces.push(...run.traces);
      let geval: Record<string, number> | null = null;
      if (judge && gevalSteps) {
        const judged = await judgeTranscript(judge, run.transcript.join("\n"), gevalSteps);
        judgeCost += judged.costUsd;
        await services.spend.record(judged.costUsd);
        if (!judged.error) {
          geval = judged.scores;
          personaScores.push(judged.scores);
        } else console.log(`    G-Eval falhou: ${judged.error}`);
      }
      benchmarkRuns.push({ persona: persona.id, style: persona.style, pass: !failures.length, geval });
      turns += run.turns;
      questions += run.outcome.agentQuestions;
      cost += run.cost;
      console.log(`${failures.length ? "✗" : "✓"} ${persona.id} #${i + 1} · ${run.turns} turnos · ${run.outcome.agentQuestions} perguntas · US$ ${run.cost.toFixed(4)}`);
      if (failures.length) console.log(`    falhou: ${failures.join("; ")}\n    ${run.transcript.join("\n    ").slice(0, 1500)}`);
    }
    const meanScores = personaScores.length
      ? Object.fromEntries(Object.keys(personaScores[0]).map((id) => [id, personaScores.reduce((s, g) => s + (g[id] ?? 0), 0) / personaScores.length]))
      : null;
    rows.push({ id: persona.id, style: persona.style, c, turns: turns / k, questions: questions / k, cost: cost / k, telemetry: summarizeTelemetry(personaTraces), geval: meanScores });
  }

  console.log(`\nPersona          pass^1  pass^${k}  turnos  perguntas  custo/conversa`);
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(16)} ${passHatK(k, row.c, 1).toFixed(2).padStart(6)}  ${passHatK(k, row.c, k).toFixed(2).padStart(6)}  ${row.turns.toFixed(1).padStart(6)}  ${row.questions.toFixed(1).padStart(9)}  US$ ${row.cost.toFixed(4)}`,
    );
  }
  const mean = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const avgPassK = mean((r) => passHatK(k, r.c, k));
  console.log(`\nMédia: pass^1 ${mean((r) => passHatK(k, r.c, 1)).toFixed(2)} · pass^${k} ${avgPassK.toFixed(2)} · custo total US$ ${(mean((r) => r.cost) * rows.length * k + judgeCost).toFixed(2)}`);
  const gates = evaluateGates(benchmarkRuns);
  writeBenchmarkReport({ k, rows, gates, judgeCost, judge: judge?.model ?? null });
  process.exit(avgPassK < min || !gates.approved ? 1 : 0);
}

interface BenchmarkRow {
  id: string;
  style: string;
  c: number;
  turns: number;
  questions: number;
  cost: number;
  telemetry: TelemetrySummary;
  geval: Record<string, number> | null;
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const secs = (v: number) => `${(v / 1000).toFixed(1).replace(".", ",")} s`;
const decimal = (v: number) => v.toFixed(2).replace(".", ",");

/** Relatório do benchmark: portões com IC, uma linha por persona com a telemetria e a G-Eval. */
function writeBenchmarkReport(input: { k: number; rows: BenchmarkRow[]; gates: ReturnType<typeof evaluateGates>; judgeCost: number; judge: string | null }) {
  const { k, rows, gates, judgeCost, judge } = input;
  const sha = execSync("git rev-parse --short HEAD").toString().trim();
  const date = new Date().toISOString().slice(0, 10);
  const ci = (g: { k: number; n: number; low: number; high: number }) => `${g.k}/${g.n} = ${pct(g.n ? g.k / g.n : 0)} [IC 95% ${pct(g.low)}–${pct(g.high)}]`;
  const meanOf = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
  const lines = [
    "# Benchmark de personas: estado no banco, telemetria e G-Eval",
    "",
    `Gerado por \`npm run eval:sim\` em ${date}, código \`${sha}\`. ${rows.length} personas × ${k} execuções. Agent: \`${process.env.LLM_MODEL ?? "padrão"}\`; funcionário simulado: \`${SIM_MODEL}\`; juiz G-Eval: \`${judge ?? "desligado"}\` (US$ ${judgeCost.toFixed(4)}).`,
    "",
    `## Portões: ${gates.approved ? "**APROVADO**" : "**NÃO APROVADO**"}`,
    "",
    `- Sucesso no estado do banco ≥ ${pct(GATES.passRate)}: ${ci(gates.passRate)} ${gates.passRate.ok ? "✓" : "✗"}`,
    ...gates.byStyle.map((s) => `  - ${s.style}: ${ci(s)} ${s.ok ? "✓" : "✗"}`),
    gates.geval.length
      ? `- G-Eval ≥ ${decimal(GATES.geval)} por critério: ${gates.geval.map((g) => `${g.criterion} ${decimal(g.mean)} ${g.ok ? "✓" : "✗"}`).join(" · ")}`
      : "- G-Eval: não medida",
    "",
    "O IC de Wilson mostra o que a amostra prova: com 54 execuções e nenhuma falha, o limite inferior ainda fica perto de 93%.",
    "",
    "## Por persona",
    "",
    `| Persona | Estilo | pass^1 | pass^${k} | Turnos | Buscas (vereditos) | Degradadas | p95 do turno | Tokens | Regras | Reserva | G-Eval média | US$/conversa |`,
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => {
      const t = r.telemetry;
      const verdicts = Object.entries(t.verdicts).map(([v, n]) => `${v} ${n}`).join(", ") || "—";
      const geval = r.geval ? decimal(meanOf(Object.values(r.geval))) : "—";
      return `| ${r.id} | ${r.style} | ${decimal(passHatK(k, r.c, 1))} | ${decimal(passHatK(k, r.c, k))} | ${r.turns.toFixed(1)} | ${t.retrievals} (${verdicts}) | ${t.degradedRetrievals} | ${secs(t.turnLatency.p95)} | ${t.tokens.input + t.tokens.output} | ${t.guardrails} | ${t.fallbackTurns} | ${geval} | ${r.cost.toFixed(4)} |`;
    }),
    "",
  ];
  mkdirSync("evals/sim/results", { recursive: true });
  writeFileSync(`evals/sim/results/${date}.json`, JSON.stringify({ date, sha, k, gates, rows }, null, 2));
  writeFileSync("docs/validacao/BENCHMARK-PERSONAS.md", lines.join("\n"));
  console.log(`\n${lines.slice(4, 8 + gates.byStyle.length).join("\n")}\nRelatório: docs/validacao/BENCHMARK-PERSONAS.md`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
