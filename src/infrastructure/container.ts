/**
 * Composition root: o único lugar que liga as peças (repositórios → serviços).
 * As rotas e o agent pedem `createServices()` e recebem tudo pronto.
 */
import { ConversationService } from "@/application/conversation-service";
import { DraftService } from "@/application/draft-service";
import { FeedbackService } from "@/application/feedback-service";
import { InsightsService } from "@/application/insights-service";
import { KnowledgeService } from "@/application/knowledge-service";
import { ReplySuggestionService } from "@/application/reply-suggestion-service";
import { TicketService } from "@/application/ticket-service";
import { missingApiKey, pricePerToken } from "@/agent/model-config";
import { mastraReplyWriter } from "@/agent/reply-writer";
import type { Embedder } from "@/application/ports";
import { ProviderBreaker } from "@/application/provider-breaker";
import { env } from "@/config/env";
import { GeminiEmbedder } from "./ai/gemini-embedder";
import { DEEPINFRA, OpenRouterEmbedder } from "./ai/openrouter-embedder";
import { OpenRouterRelevanceJudge } from "./ai/openrouter-relevance-judge";
import { db } from "./db/client";
import { FlakyTicketRepository } from "./legacy-ticket-system";
import { DrizzleBudgetRepository } from "./repositories/budget-repository";
import { DrizzleChangeFeed } from "./repositories/change-feed";
import { DrizzleConversationRepository } from "./repositories/conversation-repository";
import { DrizzleDraftRepository } from "./repositories/draft-repository";
import { DrizzleArticleRepository, DrizzleEmployeeRepository } from "./repositories/employee-repository";
import { DrizzleFeedbackRepository } from "./repositories/feedback-repository";
import { DrizzleInsightsSource } from "./repositories/insights-source";
import { DrizzleSuggestionRepository } from "./repositories/suggestion-repository";
import { DrizzleMessageRepository } from "./repositories/message-repository";
import { DrizzleTicketRepository } from "./repositories/ticket-repository";
import { OtlpTraceExporter, telemetryConfig } from "./telemetry/otlp-exporter";
import { CompositeTelemetry, processMetrics } from "./telemetry/prometheus";
import { SpendLedger } from "@/application/spend-ledger";
import { DrizzleSpendStore, FileSpendStore } from "./repositories/spend-store";

export interface ServiceOptions {
  /** Espaço derivado da identidade autenticada da demonstração. */
  demoScope?: string;
  /** Avisado quando o sistema legado falha e a chamada é repetida. */
  onLegacyRetry?: (attempt: number) => void;
}

/** Um só por instância, fora do createServices: um provedor sem crédito (embeddings ou avaliador) não é tentado de novo a cada mensagem. */
const embeddingBreaker = new ProviderBreaker();

export function createServices(options: ServiceOptions = {}) {
  const database = db();
  const employees = new DrizzleEmployeeRepository(database);
  const articles = new DrizzleArticleRepository(database);
  const messages = new DrizzleMessageRepository(database);
  const budget = new DrizzleBudgetRepository(database);
  const legacyTickets = new FlakyTicketRepository(new DrizzleTicketRepository(database, options.demoScope), env().LEGACY_FAILURE_RATE);

  const tickets = new TicketService(legacyTickets, { onRetry: options.onLegacyRetry });
  const conversationRepository = new DrizzleConversationRepository(database, options.demoScope);
  const conversations = new ConversationService(conversationRepository, messages);
  const drafts = new DraftService(new DrizzleDraftRepository(database), tickets, conversations, messages);

  const feedback = new FeedbackService(new DrizzleFeedbackRepository(database), messages, conversationRepository);
  const config = env();
  // Ordem da busca por sentido: DeepInfra, OpenRouter, depois Gemini direto. Sem nenhum, só palavras-chave.
  const embedders: Embedder[] = [];
  if (config.DEEPINFRA_API_KEY && config.DEEPINFRA_EMBEDDING_MODEL !== "off") embedders.push(new OpenRouterEmbedder(config.DEEPINFRA_EMBEDDING_MODEL, config.DEEPINFRA_API_KEY, DEEPINFRA));
  if (config.OPENROUTER_API_KEY && config.OPENROUTER_EMBEDDING_MODEL !== "off") embedders.push(new OpenRouterEmbedder(config.OPENROUTER_EMBEDDING_MODEL, config.OPENROUTER_API_KEY));
  if (config.GOOGLE_GENERATIVE_AI_API_KEY) embedders.push(new GeminiEmbedder(config.EMBEDDING_MODEL, config.GOOGLE_GENERATIVE_AI_API_KEY));
  // RELEVANCE_JUDGE_MODEL com "deepinfra/" vai pela DeepInfra; sem prefixo, pelo OpenRouter (como antes).
  const judgeOnDeepInfra = config.RELEVANCE_JUDGE_MODEL.startsWith("deepinfra/");
  const judge =
    config.RELEVANCE_JUDGE_MODEL === "off"
      ? null
      : judgeOnDeepInfra
        ? config.DEEPINFRA_API_KEY
          ? new OpenRouterRelevanceJudge(config.RELEVANCE_JUDGE_MODEL.slice("deepinfra/".length), config.DEEPINFRA_API_KEY, DEEPINFRA)
          : null
        : config.OPENROUTER_API_KEY
          ? new OpenRouterRelevanceJudge(config.RELEVANCE_JUDGE_MODEL, config.OPENROUTER_API_KEY)
          : null;
  const knowledge = new KnowledgeService(
    articles,
    embedders,
    (error, model) => console.error(`[busca] ${model}:`, error instanceof Error ? error.message : String(error)),
    embeddingBreaker,
    judge,
  );
  const suggestionRepository = new DrizzleSuggestionRepository(database, options.demoScope);
  const insights = new InsightsService(new DrizzleInsightsSource(database, options.demoScope), pricePerToken, suggestionRepository);
  const writer = missingApiKey(config.LLM_MODEL, config) ? null : mastraReplyWriter;
  const replySuggestions = new ReplySuggestionService(conversations, budget, writer, suggestionRepository, config.TOTAL_AGENT_TURN_LIMIT);

  const spend = new SpendLedger(config.SPEND_LEDGER_FILE ? new FileSpendStore(config.SPEND_LEDGER_FILE) : new DrizzleSpendStore(database), {
    dailyUsd: config.LLM_DAILY_BUDGET_USD,
    totalUsd: config.LLM_TOTAL_BUDGET_USD,
  });
  const changes = new DrizzleChangeFeed(database, options.demoScope);
  // Prometheus sempre (memória do processo, lida em /api/metrics); OTLP/Langfuse só configurado.
  const telemetrySettings = telemetryConfig(config);
  const telemetry = new CompositeTelemetry([processMetrics(), ...(telemetrySettings ? [new OtlpTraceExporter(telemetrySettings)] : [])]);

  return { employees, articles, knowledge, messages, budget, spend, tickets, conversations, drafts, feedback, insights, replySuggestions, changes, telemetry };
}

export type Services = ReturnType<typeof createServices>;
