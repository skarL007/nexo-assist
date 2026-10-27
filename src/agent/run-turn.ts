/**
 * Um turno do chat: recebe a mensagem do funcionário e produz eventos em tempo real
 * (passos, cards, texto) até a resposta final ser salva.
 *
 *   1. checa limites (30 mensagens por sessão, teto diário de custo)
 *   2. salva a mensagem; se a conversa está com um analista, o agent não responde
 *   3. roda o agent com as últimas mensagens; o 1º passo é sempre recordUnderstanding
 *   4. salva a resposta com o trace (decisão, passos, tools, tokens, tempo)
 */
import { RequestContext } from "@mastra/core/request-context";
import type { ChatStreamEvent } from "@/contracts/chat";
import { env } from "@/config/env";
import { agentCanReply } from "@/domain/conversation";
import type { Employee } from "@/domain/employee";
import { DomainError } from "@/domain/errors";
import type { ChatMessage, DraftSnapshot, ToolCallLog, TurnTrace } from "@/domain/message";
import { createServices, type Services } from "@/infrastructure/container";
import { conversationView } from "@/server/views";
import { nexoAgent } from "./nexo-agent";
import { formatDateTime } from "./tools/shared";
import { TURN_KEY, TurnRecorder, type TurnContext } from "./turn-context";

/** Quantas mensagens anteriores vão para o modelo (custo × contexto). */
const HISTORY_LIMIT = 20;
const MAX_STEPS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function* runAgentTurn(employee: Employee, text: string): AsyncGenerator<ChatStreamEvent> {
  const startedAt = new Date();
  const recorder = new TurnRecorder();
  const services = createServices({
    onLegacyRetry: (attempt) => recorder.step("sistema de chamados instável", `Tentativa ${attempt} falhou, tentando de novo`, false),
  });

  const conversation = await services.conversations.getOrStart(employee.id);
  await assertWithinLimits(services, conversation.id);

  const employeeMessage = await services.messages.add({ conversationId: conversation.id, role: "employee", text });
  yield { type: "employee_message", message: employeeMessage };

  // Com um analista (ou aguardando um), o agent fica em silêncio.
  if (!agentCanReply(conversation.status)) {
    yield { type: "done", conversation: await conversationView(services, conversation) };
    return;
  }

  if (!env().GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY não configurada.");

  const [history, pendingDrafts] = await Promise.all([
    services.messages.listRecent(conversation.id, HISTORY_LIMIT),
    services.drafts.pending(conversation.id),
  ]);

  const requestContext = new RequestContext();
  const turn: TurnContext = { employee, conversationId: conversation.id, startedAt, services, recorder };
  requestContext.set(TURN_KEY, turn);

  const stream = await nexoAgent().stream(toModelMessages(history), {
    requestContext,
    system: turnBriefing(employee, startedAt, pendingDrafts),
    maxSteps: MAX_STEPS,
    modelSettings: { temperature: 0.2 },
    // Passo 0: obriga o modelo a registrar o que entendeu. Depois de transferir, não age mais.
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 0) return { toolChoice: { type: "tool", toolName: "recordUnderstanding" } };
      if (recorder.handedOff) return { toolChoice: "none" };
      return undefined;
    },
  });

  let reply = "";
  const toolCalls: ToolCallLog[] = [];
  const startedCalls = new Map<string, { at: number; input: unknown }>();

  for await (const chunk of stream.fullStream) {
    if (chunk.type === "text-delta") {
      reply += chunk.payload.text;
      yield { type: "text", delta: chunk.payload.text };
    } else if (chunk.type === "tool-call") {
      startedCalls.set(chunk.payload.toolCallId, { at: Date.now(), input: chunk.payload.args });
    } else if (chunk.type === "tool-result") {
      const started = startedCalls.get(chunk.payload.toolCallId);
      toolCalls.push({
        tool: chunk.payload.toolName,
        input: started?.input ?? chunk.payload.args,
        output: chunk.payload.result,
        durationMs: started ? Date.now() - started.at : 0,
      });
    } else if (chunk.type === "error") {
      throw chunk.payload.error;
    }
    yield* recorder.drain();
  }

  const usage = await stream.usage.catch(() => null);
  const trace: TurnTrace = {
    decision: recorder.decision,
    steps: recorder.steps,
    toolCalls,
    guardrails: recorder.guardrails,
    model: env().LLM_MODEL,
    usage: usage ? { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 } : null,
    latencyMs: Date.now() - startedAt.getTime(),
  };

  await services.messages.add({
    conversationId: conversation.id,
    role: "agent",
    text: reply.trim() || fallbackReply(recorder),
    cards: recorder.cards,
    trace,
  });

  const updated = await services.conversations.get(conversation.id);
  yield { type: "done", conversation: await conversationView(services, updated) };
}

async function assertWithinLimits(services: Services, conversationId: string) {
  if ((await services.conversations.remainingMessages(conversationId)) <= 0) {
    throw new DomainError("message_limit", "Você chegou ao limite de mensagens desta sessão. Comece uma nova conversa para continuar.");
  }
  const repliesLast24h = await services.messages.countByRoleSince("agent", new Date(Date.now() - DAY_MS));
  if (repliesLast24h >= env().DAILY_AGENT_TURN_LIMIT) {
    throw new DomainError("daily_limit", "O Nexo Assist atingiu o limite de uso de hoje. Fale com o service desk pelo ramal 4000.");
  }
}

/** Contexto que muda a cada turno: quem é, que horas são, rascunhos pendentes. */
function turnBriefing(employee: Employee, now: Date, pendingDrafts: DraftSnapshot[]): string {
  const drafts = pendingDrafts.length
    ? pendingDrafts
        .map((d) => `D-${d.id} (${d.kind === "create" ? `novo chamado: "${d.fields.title}"` : `atualização do ${d.fields.ticketCode}`})`)
        .join("; ")
    : "nenhum";
  return [
    "Contexto deste turno:",
    `- Funcionário logado: ${employee.name} (${employee.email}), área ${employee.department}.`,
    `- Agora: ${formatDateTime(now)} (Brasília).`,
    `- Rascunhos aguardando confirmação: ${drafts}.`,
  ].join("\n");
}

/** Histórico em formato de chat. Cards viram um resumo curto entre colchetes (economiza tokens). */
function toModelMessages(history: ChatMessage[]) {
  return history.map((message) => {
    if (message.role === "employee") return { role: "user" as const, content: message.text };
    const prefix = message.role === "analyst" ? `[Analista ${message.authorName}] ` : message.role === "system" ? "[Sistema] " : "";
    const cards = message.cards.map(describeCard).filter(Boolean).join(" ");
    return { role: "assistant" as const, content: `${prefix}${message.text} ${cards}`.trim() };
  });
}

function describeCard(card: ChatMessage["cards"][number]): string {
  switch (card.kind) {
    case "ticket":
      return `[card ${card.ticket.code}: ${card.ticket.title} · ${card.ticket.status}${card.ticket.overdue ? " · VENCIDO" : ""}]`;
    case "ticket_choice":
      return `[lista para escolher: ${card.tickets.map((t) => `${t.code} ${t.title}`).join("; ")}]`;
    case "draft":
      return `[rascunho D-${card.draft.id} mostrado para confirmação]`;
    case "quick_replies":
      return `[opções: ${card.options.join(" | ")}]`;
    case "handoff":
      return "";
  }
}

function fallbackReply(recorder: TurnRecorder): string {
  if (recorder.handedOff) return "Um analista vai continuar o seu atendimento por aqui.";
  if (recorder.cards.length) return "Confira abaixo.";
  return "Desculpe, não consegui entender. Pode me contar de outro jeito?";
}
