/**
 * Processo de UM candidato: roda os cenários de `evals/scenarios.ts` com o agent
 * de verdade (runAgentTurn, o mesmo caminho da produção), trocando só o LLM_MODEL.
 *
 * Roda em processo separado porque o agent e o env são criados uma vez por processo.
 * Cada candidato tem banco próprio, recriado a cada repetição. Não chame direto:
 * é iniciado pelo `npm run benchmark`.
 */
import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Employee } from "@/domain/employee";
import type { ChatMessage } from "@/domain/message";
import { checkScenario } from "../checks";
import { describeError } from "../describe-error";
import { classifyEvalError, EvalHarnessError } from "../provider-errors";
import type { Scenario } from "../scenarios";
import { installCostMeter, type CostMeter } from "./cost-meter";
import { conversationsFile, databaseFile, JOB_ENV, jobSchema, PROGRESS_PREFIX, scenariosForRep, type CandidateJob, type Progress } from "./job";
import { appendJsonl, clip, conversationKey, conversationRecordSchema, readJsonl, type ConversationRecord, type TurnRecord } from "./records";
import { describeCard } from "./transcript";

const job = jobSchema.parse(JSON.parse(process.env[JOB_ENV] ?? "{}"));

// Ambiente do candidato ANTES de importar o agent (o env é lido na primeira chamada).
const dbFile = databaseFile(job.candidate);
mkdirSync(dirname(dbFile), { recursive: true });
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.LEGACY_FAILURE_RATE = "0";
process.env.LLM_MODEL = `openrouter/${job.model}`;
process.env.OPENROUTER_REASONING_EFFORT = job.effort;

// Diagnóstico opcional: grava cada corpo enviado ao OpenRouter (para ver a ordem do prompt).
const dumpFile = process.env.BENCHMARK_DUMP_REQUESTS;
const meter = installCostMeter(dumpFile ? (body) => appendFileSync(dumpFile, `${body}\n`) : undefined);

const MAX_ATTEMPTS = 3;
const RETRY_WAIT_MS = 15_000;

const conversationCost = (record: ConversationRecord) =>
  record.turns.flatMap((t) => t.llmCalls).reduce((sum, c) => sum + c.costUsd, 0);

const wasRateLimited = (record: ConversationRecord) =>
  record.turns.some((t) => t.error && (t.llmCalls.some((c) => c.status === 429) || /rate-?limit/i.test(t.error)));

function report(progress: Progress) {
  console.log(`${PROGRESS_PREFIX}${JSON.stringify(progress)}`);
}

async function main() {
  const { runAgentTurn } = await import("@/agent/run-turn");
  const { createServices } = await import("@/infrastructure/container");
  const { db } = await import("@/infrastructure/db/client");
  const { freeMessageWindow } = await import("../message-window");

  const file = conversationsFile(job.candidate);
  const done = new Set(readJsonl(file, conversationRecordSchema).map(conversationKey));
  let spent = 0;

  // Cenários do mesmo modelo em sequência: o cache do provedor fica quente entre eles.
  for (let rep = 1; rep <= job.reps; rep++) {
    const todo = scenariosForRep(rep, job.scenarioFilter).filter((s) => !done.has(conversationKey({ candidate: job.candidate, scenario: s.name, rep })));
    if (todo.length === 0) continue;
    // Cada repetição começa dos dados de exemplo originais.
    execSync("npm run db:setup", { stdio: "ignore", env: process.env });
    const services = createServices();

    for (const scenario of todo) {
      if (spent >= job.maxSpendUsd) {
        report({ type: "stopped", reason: `limite do candidato (US$ ${job.maxSpendUsd.toFixed(2)}) atingido` });
        return;
      }
      const employee = await services.employees.findByEmail(scenario.employee);
      if (!employee) throw new Error(`Funcionário ${scenario.employee} não existe no seed`);

      // Provedor com limite de taxa (HTTP 429) não diz nada sobre a qualidade do modelo:
      // espera e refaz o cenário numa conversa nova. As tentativas ficam registradas.
      let record: ConversationRecord;
      let discardedCostUsd = 0;
      let attempt = 1;
      for (; ; attempt++) {
        await services.conversations.closeOpen(employee.id);
        // O app limita mensagens por pessoa (40/h, 120/dia): sem isto os últimos cenários virariam "erro técnico".
        await freeMessageWindow(db(), employee.id);
        record = await runScenario(job, scenario, rep, employee, runAgentTurn, meter);
        if (!wasRateLimited(record) || attempt === MAX_ATTEMPTS) break;
        discardedCostUsd += conversationCost(record);
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS * attempt));
      }
      record = { ...record, attempts: attempt, discardedCostUsd };
      appendJsonl(file, record);
      const cost = conversationCost(record) + discardedCostUsd;
      spent += cost;
      report({ type: "conversation", scenario: scenario.name, rep, costUsd: cost, passed: record.failures.length === 0 });
    }
  }
}

type RunTurn = (typeof import("@/agent/run-turn"))["runAgentTurn"];

async function runScenario(job: CandidateJob, scenario: Scenario, rep: number, employee: Employee, runAgentTurn: RunTurn, meter: CostMeter) {
  const turns: TurnRecord[] = [];
  let finalStatus = "with_agent";
  await meter.take(); // descarta chamadas de fora do cenário

  for (const text of scenario.turns) {
    const startedAt = performance.now();
    let ttftMs: number | null = null;
    let error: string | null = null;
    let reply: ChatMessage | null = null;

    try {
      const signal = AbortSignal.timeout(job.turnTimeoutMs);
      for await (const event of runAgentTurn(employee, text, signal)) {
        if (event.type === "text" && ttftMs === null) ttftMs = performance.now() - startedAt;
        if (event.type === "error") error = event.message;
        if (event.type === "done") {
          finalStatus = event.conversation.status;
          reply = lastAgentMessage(event.conversation.messages);
        }
      }
    } catch (caught) {
      // Regra do app (ex.: message_limit) e banco não dizem nada sobre o modelo: parar, não gravar como "erro técnico" dele.
      const kind = classifyEvalError(caught);
      if (kind === "domain" || kind === "database") {
        throw new EvalHarnessError(`${scenario.name} (rep ${rep}): ${kind === "domain" ? "erro de regra do app" : "erro de banco"}, não do modelo: ${describeError(caught)}`, { cause: caught });
      }
      error = caught instanceof Error ? caught.message : String(caught);
    }

    const latencyMs = performance.now() - startedAt;
    const trace = reply?.trace ?? null;
    turns.push({
      text,
      reply: reply?.text ?? "",
      cards: reply?.cards.map(describeCard) ?? [],
      decision: trace?.decision
        ? {
            intent: trace.decision.intent,
            understanding: trace.decision.understanding,
            confidence: trace.decision.confidence,
            reasoning: trace.decision.reasoning,
          }
        : null,
      firstTool: trace?.toolCalls[0]?.tool ?? null,
      toolCalls: (trace?.toolCalls ?? []).map((c) => ({ tool: c.tool, input: clip(c.input, 200), output: clip(c.output) })),
      guardrails: trace?.guardrails ?? [],
      latencyMs,
      ttftMs,
      llmCalls: await meter.take(),
      error: error ? clip(error, 300) : null,
    });
  }

  const lastIntent = [...turns].reverse().find((t) => t.decision)?.decision?.intent;
  const record: ConversationRecord = {
    candidate: job.candidate,
    model: job.model,
    effort: job.effort,
    scenario: scenario.name,
    rep,
    employeeName: employee.name,
    startedAt: new Date().toISOString(),
    turns,
    finalStatus,
    attempts: 1,
    discardedCostUsd: 0,
    failures: checkScenario(scenario.expect, {
      lastIntent,
      toolsUsed: turns.flatMap((t) => t.toolCalls.map((c) => c.tool)),
      finalStatus,
      replies: turns.map((t) => t.reply),
    }),
  };
  // Turno que quebrou também reprova o cenário (o funcionário ficou sem resposta).
  if (turns.some((t) => t.error)) record.failures.push("erro técnico em turno");
  return record;
}

function lastAgentMessage(messages: ChatMessage[]): ChatMessage | null {
  const last = messages.at(-1);
  return last?.role === "agent" ? last : null;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
