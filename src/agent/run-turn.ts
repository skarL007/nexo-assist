/**
 * Um turno do chat: recebe a mensagem do funcionário e produz eventos em tempo real
 * (passos, cards, texto) até a resposta final ser salva.
 *
 *   1. checa limites (30 mensagens por sessão, 40/h e 120/dia por pessoa)
 *   2. salva a mensagem e confere os limites de novo; com um analista, o agent não responde
 *   3. roda o agent com as últimas mensagens; o 1º passo é sempre recordUnderstanding
 *   4. salva a resposta com o trace (decisão, passos, tools, tokens, tempo)
 */
import { OFFER_ANALYST_OPTION } from "@/domain/frustration";
import { RequestContext } from "@mastra/core/request-context";
import type { ChatStreamEvent } from "@/contracts/chat";
import { env } from "@/config/env";
import { agentCanReply, EMPLOYEE_MESSAGES_PER_DAY, EMPLOYEE_MESSAGES_PER_HOUR } from "@/domain/conversation";
import type { Employee } from "@/domain/employee";
import { DomainError } from "@/domain/errors";
import type { ToolCallLog, TurnTrace } from "@/domain/message";
import { createServices, type Services } from "@/infrastructure/container";
import { conversationView } from "@/server/views";
import { missingApiKey, missingKeyMessage, providerOptionsFor } from "./model-config";
import { stripMarkdown, stripSystemNotes, toModelMessages } from "./model-history";
import { fallbackNote, readStepFinish, type StepFinishPayload } from "./model-fallback";
import { agentModels, nexoAgent } from "./nexo-agent";
import { needsContinuation, stepPolicy } from "./step-policy";
import { turnBriefing } from "./turn-briefing";
import { TURN_KEY, TurnRecorder, type TurnContext } from "./turn-context";

/** Quantas mensagens anteriores vão para o modelo (custo × contexto). */
const HISTORY_LIMIT = 20;
const MAX_STEPS = 6;
/** Teto de tokens de saída por passo: respostas curtas por regra, não só por pedido no prompt. */
const MAX_OUTPUT_TOKENS = 800;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function* runAgentTurn(employee: Employee, text: string, abortSignal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  const startedAt = new Date();
  const recorder = new TurnRecorder();
  const services = createServices({
    onLegacyRetry: (attempt) => recorder.step("sistema de chamados instável", `Tentativa ${attempt} falhou, tentando de novo`, false),
  });

  const conversation = await services.conversations.getOrStart(employee.id);
  await assertWithinPersonalLimits(services, employee.id, conversation.id);
  // Sem chave do modelo, explica antes de gravar (a mensagem não fica sem resposta nem gasta a cota).
  // Com um analista, a mensagem segue para ele: o modelo não é chamado.
  const missingKey = agentCanReply(conversation.status) ? missingApiKey(env().LLM_MODEL, env()) : null;
  if (missingKey) {
    const production = env().NODE_ENV === "production";
    if (production) console.error(`[config] ${missingKey} não definida: o agent não pode responder.`);
    throw new DomainError("agent_unavailable", missingKeyMessage(missingKey, production));
  }

  const employeeMessage = await services.messages.add({ conversationId: conversation.id, role: "employee", text });
  await assertWithinPersonalLimits(services, employee.id, conversation.id, { saved: true });
  yield { type: "employee_message", message: employeeMessage };

  // Com um analista (ou aguardando um), o agent fica em silêncio.
  if (!agentCanReply(conversation.status)) {
    yield { type: "done", conversation: await conversationView(services, conversation) };
    return;
  }

  // Tetos globais conferidos DEPOIS de gravar e ANTES do modelo: pedidos simultâneos enxergam uns aos outros.
  await assertWithinBudget(services);

  try {
    yield* replyWithAgent({ employee, conversationId: conversation.id, startedAt, services, recorder }, abortSignal);
  } catch (error) {
    // Rascunho criado num turno que falhou nunca foi mostrado: não pode ser confirmado depois.
    await services.drafts.cancelPending(conversation.id, startedAt);
    throw error;
  }

  const updated = await services.conversations.get(conversation.id);
  yield { type: "done", conversation: await conversationView(services, updated) };
}

/** Roda o modelo com as tools, repassa os eventos e salva a resposta com o trace. */
async function* replyWithAgent(turn: TurnContext, abortSignal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  const { employee, conversationId, startedAt, services, recorder } = turn;

  const [history, pendingDrafts] = await Promise.all([
    services.messages.listRecent(conversationId, HISTORY_LIMIT),
    services.drafts.pending(conversationId),
  ]);

  const run: AgentRun = { reply: "", toolCalls: [], usage: null, fallbackModel: null };
  const messages = toModelMessages(history);
  const system = turnBriefing(employee, startedAt, pendingDrafts);

  yield* streamAgent(turn, messages, system, 0, run, abortSignal);
  // Turno cortado só com recordUnderstanding repetido: continua uma vez a partir do passo 1.
  if (needsContinuation({ reply: run.reply, handedOff: recorder.handedOff, toolCalls: run.toolCalls })) {
    recorder.guardrail("O modelo repetiu o registro do entendimento sem agir: o turno continuou a partir das ações.");
    yield* streamAgent(turn, messages, system, 1, run, abortSignal);
  }

  // Oferta por frustração é do código, não do modelo: o botão aparece mesmo que a resposta esqueça de oferecer.
  if (recorder.offerAnalyst && !recorder.handedOff) {
    const replies = recorder.cards.find((c) => c.kind === "quick_replies");
    if (!replies) recorder.card({ kind: "quick_replies", options: [OFFER_ANALYST_OPTION] });
    else if (!replies.options.includes(OFFER_ANALYST_OPTION)) replies.options.push(OFFER_ANALYST_OPTION);
  }

  if (run.fallbackModel) recorder.guardrail(fallbackNote(env().LLM_MODEL, run.fallbackModel));

  const trace: TurnTrace = {
    decision: recorder.decision,
    steps: recorder.steps,
    toolCalls: run.toolCalls,
    guardrails: recorder.guardrails,
    model: run.fallbackModel ?? env().LLM_MODEL,
    fallbackFrom: run.fallbackModel ? env().LLM_MODEL : null,
    usage: run.usage,
    latencyMs: Date.now() - startedAt.getTime(),
  };

  const reply = await services.messages.add({
    conversationId,
    role: "agent",
    text: stripMarkdown(stripSystemNotes(run.reply)) || fallbackReply(recorder),
    cards: recorder.cards,
    trace,
  });

  // Observabilidade externa opcional (OpenTelemetry/Langfuse). Sem configuração, telemetry é null.
  // Esperado aqui (até 2 s) porque a função da Vercel pode congelar depois da resposta.
  await services.telemetry?.turnFinished({
    conversationId,
    employeeId: employee.id,
    startedAt,
    trace,
    input: history.findLast((m) => m.role === "employee")?.text ?? "",
    output: reply.text,
  });
}

/** O que um turno acumula, mesmo quando o modelo roda duas vezes (ver needsContinuation). */
interface AgentRun {
  reply: string;
  toolCalls: ToolCallLog[];
  usage: TurnTrace["usage"];
  /** Modelo reserva que assumiu (o principal falhou num passo), ou null. */
  fallbackModel: string | null;
}

/** Uma chamada ao agent a partir de `firstStep`: repassa os eventos e acumula em `run`. */
async function* streamAgent(
  turn: TurnContext,
  messages: ReturnType<typeof toModelMessages>,
  system: string,
  firstStep: number,
  run: AgentRun,
  abortSignal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const { recorder } = turn;
  const requestContext = new RequestContext();
  requestContext.set(TURN_KEY, turn);

  const stream = await nexoAgent().stream(messages, {
    requestContext,
    system,
    maxSteps: MAX_STEPS - firstStep,
    abortSignal,
    modelSettings: { temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS },
    // O modelo "pensa" antes de responder; para atendimento, raciocínio mínimo basta e corta a latência.
    providerOptions: providerOptionsFor(env().LLM_MODEL, env().OPENROUTER_REASONING_EFFORT, turn.conversationId),
    // Passo 0: obriga o modelo a registrar o que entendeu. Depois de transferir, não age mais.
    prepareStep: ({ stepNumber }) => stepPolicy(firstStep + stepNumber, recorder.handedOff, recorder.clarifying),
  });

  const startedCalls = new Map<string, { at: number; input: unknown }>();
  for await (const chunk of stream.fullStream) {
    if (chunk.type === "text-delta") {
      run.reply += chunk.payload.text;
      yield { type: "text", delta: chunk.payload.text };
    } else if (chunk.type === "tool-call") {
      startedCalls.set(chunk.payload.toolCallId, { at: Date.now(), input: chunk.payload.args });
    } else if (chunk.type === "tool-result") {
      const started = startedCalls.get(chunk.payload.toolCallId);
      run.toolCalls.push({
        tool: chunk.payload.toolName,
        input: started?.input ?? chunk.payload.args,
        output: chunk.payload.result,
        durationMs: started ? Date.now() - started.at : 0,
      });
    } else if (chunk.type === "step-finish") {
      // Uso somado passo a passo (o total do stream perde os campos depois de uma nova tentativa)
      // e o modelo reserva, se algum passo precisou dele.
      const step = readStepFinish(chunk.payload as StepFinishPayload);
      if (step.usage) {
        run.usage = {
          inputTokens: (run.usage?.inputTokens ?? 0) + step.usage.inputTokens,
          outputTokens: (run.usage?.outputTokens ?? 0) + step.usage.outputTokens,
        };
      }
      if (step.fallbackIndex !== null) run.fallbackModel = agentModels()[step.fallbackIndex]?.model ?? run.fallbackModel;
    } else if (chunk.type === "error") {
      throw chunk.payload.error;
    }
    yield* recorder.drain();
  }
}

/**
 * Limites por sessão e por pessoa (somando todas as conversas dela). Conferidos antes
 * de gravar (o caso normal, sem deixar mensagem órfã) e de novo depois (`saved`):
 * pedidos simultâneos passam juntos pela primeira checagem, mas na segunda já se enxergam.
 */
async function assertWithinPersonalLimits(services: Services, employeeId: string, conversationId: string, { saved = false } = {}) {
  const own = saved ? 1 : 0; // depois de gravar, a própria mensagem já entra na conta
  if ((await services.conversations.remainingMessages(conversationId)) + own <= 0) {
    throw new DomainError("message_limit", "Você chegou ao limite de mensagens desta sessão. Comece uma nova conversa para continuar.");
  }
  const now = Date.now();
  const [lastHour, lastDay] = await Promise.all([
    services.messages.countByEmployeeSince(employeeId, new Date(now - HOUR_MS)),
    services.messages.countByEmployeeSince(employeeId, new Date(now - DAY_MS)),
  ]);
  if (lastHour - own >= EMPLOYEE_MESSAGES_PER_HOUR || lastDay - own >= EMPLOYEE_MESSAGES_PER_DAY) {
    throw new DomainError("message_limit", "Você enviou muitas mensagens em pouco tempo. Tente de novo mais tarde.");
  }
}

/**
 * Tetos globais de custo do deploy: mensagens em 24h e, se configurado, turnos do modelo
 * no total. O total é uma reserva atômica feita antes de chamar o modelo: vale mesmo
 * para pedidos simultâneos e conta também o turno que falhar ou for cancelado.
 */
async function assertWithinBudget(services: Services) {
  const last24h = await services.messages.countByRoleSince("employee", new Date(Date.now() - DAY_MS));
  if (last24h > env().DAILY_AGENT_TURN_LIMIT) {
    throw new DomainError("daily_limit", "O Nexo Assist atingiu o limite de uso de hoje. Fale com o service desk pelo ramal 4000.");
  }
  const totalLimit = env().TOTAL_AGENT_TURN_LIMIT;
  if (totalLimit !== undefined && !(await services.budget.reserve("model_turns", totalLimit))) {
    throw new DomainError("daily_limit", "O Nexo Assist atingiu o limite de uso desta demonstração. Fale com o service desk pelo ramal 4000.");
  }
}

function fallbackReply(recorder: TurnRecorder): string {
  if (recorder.handedOff) return "Um analista vai continuar o seu atendimento por aqui.";
  if (recorder.cards.length) return "Confira abaixo.";
  return "Desculpe, não consegui entender. Pode me contar de outro jeito?";
}
