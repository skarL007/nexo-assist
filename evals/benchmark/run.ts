/**
 * Benchmark de modelos do Nexo Assist via OpenRouter.
 *
 *   npm run benchmark                         → pré-voo, candidatos, juízes e relatório
 *   npm run benchmark -- --dry-run            → plano e estimativa de custo, sem gastar
 *   npm run benchmark -- --report             → só refaz o relatório a partir do cache
 *   npm run benchmark -- --only=gpt-6-luna --reps=1
 *
 * O que já está no cache (evals/benchmark/results) não roda de novo.
 * Teto de gasto em config.BUDGET; a chave também tem limite próprio no OpenRouter.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { estimateCost, SpendTracker, usd, type Price } from "./budget";
import { ANCHORS, calibrationPasses, type AnchorLevel } from "./calibration";
import { BUDGET, CANDIDATES, JUDGES, RUN, STEPS_AUTHOR, TOKENS_PER_TURN, type Candidate, type Judge } from "./config";
import { forcedToolGate, type GateResult } from "./gate";
import { CRITERIA, type Steps } from "./geval";
import { JOB_ENV, loadConversations, PROGRESS_PREFIX, progressSchema, scenariosForRep, type CandidateJob } from "./job";
import { generateSteps, judgeTranscript } from "./judges";
import { keyInfo, listEndpoints, listModels, type CatalogModel } from "./openrouter";
import { appendJsonl, conversationKey, judgmentKey, judgmentSchema, PATHS, readJson, readJsonl, writeJson } from "./records";
import { buildReport } from "./report";
import { mean } from "./stats";
import { formatTranscript } from "./transcript";

interface Options {
  dryRun: boolean;
  reportOnly: boolean;
  only: string[] | null;
  reps: number;
  filter: string | undefined;
}

function parseArgs(argv: string[]): Options {
  const value = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return {
    dryRun: argv.includes("--dry-run"),
    reportOnly: argv.includes("--report"),
    only: value("only")?.split(",") ?? null,
    reps: Number(value("reps") ?? RUN.repetitions),
    filter: value("filter"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.reportOnly) return buildReport();

  const candidates = CANDIDATES.filter((c) => !options.only || options.only.includes(c.key));
  const reps = Array.from({ length: options.reps }, (_, i) => i + 1);

  // ── Pré-voo: catálogo e crédito da chave (grátis) ──
  const [catalog, key] = await Promise.all([listModels(), keyInfo()]);
  const byId = new Map(catalog.map((m) => [m.id, m]));
  // Preços do dia (com os de cache) ficam salvos: o relatório calcula o custo "sem cache" sem chamar a API.
  writeJson(PATHS.prices, {
    fetchedAt: new Date().toISOString(),
    models: Object.fromEntries(
      [...CANDIDATES.map((c) => c.model), ...JUDGES.map((j) => j.model)].flatMap((id) => (byId.has(id) ? [[id, byId.get(id)!.pricing]] : [])),
    ),
  });
  const gates = readJson<Record<string, GateResult>>(PATHS.gate, {});
  const startedAt = new Date().toISOString();
  // A chave é exclusiva do benchmark: o que ela já gastou conta no teto.
  const available = Math.min(BUDGET.capUsd - key.usage, key.limit_remaining ?? Infinity);
  const tracker = new SpendTracker(available);

  console.log(`\nCrédito da chave: limite ${key.limit === null ? "sem limite" : usd(key.limit, 2)}, usado ${usd(key.usage)}, restante ${key.limit_remaining === null ? "—" : usd(key.limit_remaining)}`);
  console.log(`Disponível para esta execução: ${usd(available)} (teto ${usd(BUDGET.capUsd, 2)} − já gasto)\n`);

  // ── Porta de entrada: tool_choice forçado (frações de centavo; pulada no --dry-run) ──
  if (!options.dryRun) {
    for (const candidate of candidates.filter((c) => !gates[c.key] && byId.has(c.model))) {
      const gate = await forcedToolGate(candidate);
      gates[candidate.key] = gate;
      tracker.add(gate.costUsd);
      console.log(`${gate.passed ? "✓" : "✗"} pré-voo ${candidate.key}: ${gate.passed ? `chamou ${gate.toolCalled} (${gate.provider})` : gate.error}`);
    }
    writeJson(PATHS.gate, gates);
  }

  // ── Estimativa do que falta rodar ──
  const plan = candidates.map((candidate) => {
    const model = byId.get(candidate.model);
    const done = new Set(loadConversations(candidate.key).map(conversationKey));
    let pendingTurns = 0;
    for (const rep of reps) {
      for (const s of scenariosForRep(rep, options.filter)) {
        if (!done.has(conversationKey({ candidate: candidate.key, scenario: s.name, rep }))) pendingTurns += s.turns.length;
      }
    }
    const blocked = !model
      ? "fora do catálogo"
      : !model.supported_parameters.includes("tools") || !model.supported_parameters.includes("tool_choice")
        ? "sem tools/tool_choice no catálogo"
        : gates[candidate.key] && !gates[candidate.key].passed
          ? "reprovado no pré-voo"
          : null;
    const estimate = model && !blocked ? estimateCost(priceOf(model), pendingTurns, TOKENS_PER_TURN) : 0;
    return { candidate, model, pendingTurns, blocked, estimate };
  });

  const judgePrices = await Promise.all(JUDGES.map((judge) => judgePrice(judge, byId.get(judge.model))));
  const conversationsToJudge = plan.filter((p) => !p.blocked).length * reps.reduce((sum, rep) => sum + scenariosForRep(rep, options.filter).length, 0);
  const judgedAlready = readJsonl(PATHS.judgments, judgmentSchema).length;
  const judgeEstimate = JUDGES.reduce(
    (sum, judge, i) => sum + estimateCost(judgePrices[i], Math.max(0, conversationsToJudge - judgedAlready / JUDGES.length) * judge.samples, judge.tokens),
    0,
  );
  const agentEstimate = plan.reduce((sum, p) => sum + p.estimate, 0);
  const total = agentEstimate + judgeEstimate;

  console.table(
    plan.map((p) => ({
      candidato: p.candidate.key,
      "US$/1M entrada": p.model ? (p.model.pricing.prompt * 1e6).toFixed(3) : "—",
      "US$/1M saída": p.model ? (p.model.pricing.completion * 1e6).toFixed(3) : "—",
      "turnos a rodar": p.pendingTurns,
      estimativa: usd(p.estimate),
      bloqueio: p.blocked ?? "",
    })),
  );
  console.log(`Juízes (${JUDGES.map((j) => j.label).join(" + ")}): ${usd(judgeEstimate)}`);
  console.log(`Total estimado: ${usd(total)} · disponível ${usd(tracker.remainingUsd)}\n`);

  if (total > tracker.remainingUsd) {
    console.error(`✗ Estimativa ${usd(total)} acima do disponível (${usd(tracker.remainingUsd)}). Reduza --reps ou candidatos.`);
    process.exit(1);
  }
  if (options.dryRun) return;

  // ── Candidatos: um processo por candidato, alguns em paralelo ──
  const runnable = plan.filter((p) => !p.blocked && gates[p.candidate.key]?.passed && p.pendingTurns > 0);
  await runCandidates(runnable, options, tracker);

  // ── Juízes ──
  const qualified = candidates.filter((c) => gates[c.key]?.passed);
  const responseCacheSavedUsd = await runJudges(qualified, tracker);

  buildReport();

  const after = await keyInfo();
  const runs = readJson<unknown[]>(PATHS.runs, []);
  runs.push({
    startedAt,
    finishedAt: new Date().toISOString(),
    keyUsageBeforeUsd: key.usage,
    keyUsageAfterUsd: after.usage,
    spentByKeyUsd: after.usage - key.usage,
    trackedUsd: tracker.spentUsd,
    responseCacheSavedUsd,
    keyLimitRemainingUsd: after.limit_remaining,
  });
  writeJson(PATHS.runs, runs);
  console.log(`\nGasto nesta execução: ${usd(after.usage - key.usage)} (medido pela chave) · ${usd(tracker.spentUsd)} (somado por chamada)`);
  console.log(`Crédito restante na chave: ${after.limit_remaining === null ? "—" : usd(after.limit_remaining)}`);
}

const priceOf = (model: CatalogModel): Price => ({ input: model.pricing.prompt, output: model.pricing.completion });

/** Juiz com logprobs só pode ir a provedores que devolvem logprobs: o preço é o desses. */
async function judgePrice(judge: Judge, model: CatalogModel | undefined): Promise<Price> {
  if (!model) throw new Error(`Juiz ${judge.model} fora do catálogo`);
  if (judge.method !== "logprobs") return priceOf(model);
  const prices = (await listEndpoints(judge.model))
    .filter((e) => e.supported_parameters.includes("top_logprobs"))
    .map((e) => ({ input: e.pricing.prompt, output: e.pricing.completion }));
  if (prices.length === 0) throw new Error(`Nenhum provedor de ${judge.model} devolve logprobs`);
  // O OpenRouter prefere o provedor mais barato para o volume de tokens da chamada.
  return prices.sort((a, b) => estimateCost(a, 1, judge.tokens) - estimateCost(b, 1, judge.tokens))[0];
}

async function runCandidates(runnable: Array<{ candidate: Candidate; estimate: number }>, options: Options, tracker: SpendTracker) {
  const queue = [...runnable];
  const running = new Set<ChildProcess>();
  let stopped = false;

  const startNext = (): Promise<void> | undefined => {
    const next = queue.shift();
    if (!next || stopped) return;
    const job: CandidateJob = {
      candidate: next.candidate.key,
      model: next.candidate.model,
      effort: next.candidate.effort,
      reps: options.reps,
      maxSpendUsd: Math.max(0.01, Math.min(next.estimate * BUDGET.candidateSafetyFactor, tracker.remainingUsd - BUDGET.judgeReserveUsd)),
      turnTimeoutMs: RUN.turnTimeoutMs,
      scenarioFilter: options.filter,
    };
    console.log(`▶ ${job.candidate} (limite ${usd(job.maxSpendUsd, 3)})`);
    const child = spawn(process.execPath, ["--import", "tsx", "evals/benchmark/run-candidate.ts"], {
      env: { ...process.env, [JOB_ENV]: JSON.stringify(job) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    running.add(child);

    createInterface({ input: child.stdout! }).on("line", (line) => {
      if (!line.startsWith(PROGRESS_PREFIX)) return;
      const progress = progressSchema.parse(JSON.parse(line.slice(PROGRESS_PREFIX.length)));
      if (progress.type === "stopped") return console.log(`■ ${job.candidate}: ${progress.reason}`);
      tracker.add(progress.costUsd);
      console.log(`  ${progress.passed ? "✓" : "✗"} ${job.candidate} · rep ${progress.rep} · ${progress.scenario} · ${usd(progress.costUsd)} · total ${usd(tracker.spentUsd, 3)}`);
      if (!tracker.fits(0, BUDGET.judgeReserveUsd)) {
        stopped = true;
        console.error(`■ Teto dos candidatos atingido (${usd(tracker.spentUsd, 3)}): parando todos os processos.`);
        for (const c of running) c.kill();
      }
    });
    let errors = "";
    child.stderr!.on("data", (chunk: Buffer) => (errors += chunk.toString()));

    return new Promise<void>((resolve) => {
      child.on("exit", (code) => {
        running.delete(child);
        if (code !== 0 && !stopped) console.error(`✗ ${job.candidate} saiu com código ${code}\n${errors.slice(-1500)}`);
        resolve(startNext());
      });
    });
  };

  await Promise.all(Array.from({ length: RUN.concurrency }, () => startNext()));
}

/** Roda os juízes e devolve quanto o cache local de respostas evitou pagar. */
async function runJudges(qualified: Candidate[], tracker: SpendTracker): Promise<number> {
  let savedUsd = 0;
  const criteriaIds = CRITERIA.map((c) => c.id).join(",");

  // Passos do G-Eval: gerados uma vez e congelados (refeitos só se os critérios mudarem).
  let stepsFile = readJson<{ author: string; generatedAt: string; steps: Steps } | null>(PATHS.steps, null);
  if (!stepsFile || Object.keys(stepsFile.steps).join(",") !== criteriaIds) {
    const generated = await generateSteps();
    tracker.add(generated.costUsd);
    savedUsd += generated.savedUsd;
    stepsFile = { author: STEPS_AUTHOR.model, generatedAt: new Date().toISOString(), steps: generated.steps };
    writeJson(PATHS.steps, stepsFile);
  }
  const steps = stepsFile.steps;

  // Calibração: cada juiz nas três conversas âncora.
  type Calibration = { criteria: string; judges: Record<string, Record<AnchorLevel, Record<string, number>>> };
  const saved = readJson<Calibration | null>(PATHS.calibration, null);
  const calibration: Calibration = saved?.criteria === criteriaIds ? saved : { criteria: criteriaIds, judges: {} };
  for (const judge of JUDGES.filter((j) => !calibration.judges[j.key])) {
    const levels = Object.keys(ANCHORS) as AnchorLevel[];
    const results = await Promise.all(levels.map((level) => judgeTranscript(judge, ANCHORS[level], steps)));
    results.forEach((r) => {
      tracker.add(r.costUsd);
      savedUsd += r.savedUsd;
    });
    calibration.judges[judge.key] = Object.fromEntries(levels.map((level, i) => [level, results[i].scores])) as Record<AnchorLevel, Record<string, number>>;
    const means = Object.fromEntries(levels.map((level, i) => [level, mean(Object.values(results[i].scores))])) as Record<AnchorLevel, number>;
    console.log(`${calibrationPasses(means) ? "✓" : "✗"} calibração ${judge.key}: ${levels.map((l) => `${l} ${means[l].toFixed(2)}`).join(" · ")}`);
  }
  writeJson(PATHS.calibration, calibration);

  // Avaliação das conversas: o que já está no cache não é julgado de novo. Conversa com
  // erro técnico (ex.: provedor fora do ar) já reprova na efetividade e não vai ao juiz.
  const done = new Set(readJsonl(PATHS.judgments, judgmentSchema).map(judgmentKey));
  const tasks = qualified.flatMap((candidate) =>
    loadConversations(candidate.key).filter((c) => c.turns.every((t) => !t.error)).flatMap((conversation) =>
      JUDGES.filter((judge) => !done.has(judgmentKey({ judge: judge.key, ...conversation }))).map((judge) => ({ judge, conversation })),
    ),
  );
  console.log(`\nJulgamentos a fazer: ${tasks.length}`);

  const perJudgment = 0.01; // folga por chamada para não passar do teto no meio de um lote
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      if (!tracker.fits(perJudgment)) {
        console.error(`■ Teto atingido nos juízes (${usd(tracker.spentUsd, 3)}).`);
        index = tasks.length;
        return;
      }
      const { judge, conversation } = tasks[index++];
      const result = await judgeTranscript(judge, formatTranscript(conversation), steps);
      tracker.add(result.costUsd);
      savedUsd += result.savedUsd;
      appendJsonl(PATHS.judgments, {
        judge: judge.key,
        candidate: conversation.candidate,
        scenario: conversation.scenario,
        rep: conversation.rep,
        ...result,
      });
      if (index % 20 === 0) console.log(`  ${index}/${tasks.length} julgamentos · total ${usd(tracker.spentUsd, 3)}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return savedUsd;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
