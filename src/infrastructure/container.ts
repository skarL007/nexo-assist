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
import { OpenRouterEmbedder } from "./ai/openrouter-embedder";
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

export interface ServiceOptions {
  /** Espaço derivado da identidade autenticada da demonstração. */
  demoScope?: string;
  /** Avisado quando o sistema legado falha e a chamada é repetida. */
  onLegacyRetry?: (attempt: number) => void;
}

/** Um só por instância, fora do createServices: um provedor sem crédito não é tentado de novo a cada mensagem. */
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
  // Ordem da busca por sentido: OpenRouter, depois Gemini direto. Sem nenhum, só palavras-chave.
  const embedders: Embedder[] = [];
  if (config.OPENROUTER_API_KEY && config.OPENROUTER_EMBEDDING_MODEL !== "off") embedders.push(new OpenRouterEmbedder(config.OPENROUTER_EMBEDDING_MODEL, config.OPENROUTER_API_KEY));
  if (config.GOOGLE_GENERATIVE_AI_API_KEY) embedders.push(new GeminiEmbedder(config.EMBEDDING_MODEL, config.GOOGLE_GENERATIVE_AI_API_KEY));
  const knowledge = new KnowledgeService(
    articles,
    embedders,
    (error, model) => console.error(`[embeddings] ${model}:`, error instanceof Error ? error.message : String(error)),
    embeddingBreaker,
  );
  const suggestionRepository = new DrizzleSuggestionRepository(database, options.demoScope);
  const insights = new InsightsService(new DrizzleInsightsSource(database, options.demoScope), pricePerToken, suggestionRepository);
  const writer = missingApiKey(config.LLM_MODEL, config) ? null : mastraReplyWriter;
  const replySuggestions = new ReplySuggestionService(conversations, budget, writer, suggestionRepository, config.TOTAL_AGENT_TURN_LIMIT);

  const changes = new DrizzleChangeFeed(database, options.demoScope);
  const telemetrySettings = telemetryConfig(config);
  const telemetry = telemetrySettings ? new OtlpTraceExporter(telemetrySettings) : null;

  return { employees, articles, knowledge, messages, budget, tickets, conversations, drafts, feedback, insights, replySuggestions, changes, telemetry };
}

export type Services = ReturnType<typeof createServices>;
