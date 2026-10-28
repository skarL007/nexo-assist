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
import { env } from "@/config/env";
import { GeminiEmbedder } from "./ai/gemini-embedder";
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

export interface ServiceOptions {
  /** Avisado quando o sistema legado falha e a chamada é repetida. */
  onLegacyRetry?: (attempt: number) => void;
}

export function createServices(options: ServiceOptions = {}) {
  const database = db();
  const employees = new DrizzleEmployeeRepository(database);
  const articles = new DrizzleArticleRepository(database);
  const messages = new DrizzleMessageRepository(database);
  const budget = new DrizzleBudgetRepository(database);
  const legacyTickets = new FlakyTicketRepository(new DrizzleTicketRepository(database), env().LEGACY_FAILURE_RATE);

  const tickets = new TicketService(legacyTickets, { onRetry: options.onLegacyRetry });
  const conversationRepository = new DrizzleConversationRepository(database);
  const conversations = new ConversationService(conversationRepository, messages);
  const drafts = new DraftService(new DrizzleDraftRepository(database), tickets, conversations, messages);

  const feedback = new FeedbackService(new DrizzleFeedbackRepository(database), messages, conversationRepository);
  const config = env();
  const embedder = config.GOOGLE_GENERATIVE_AI_API_KEY ? new GeminiEmbedder(config.EMBEDDING_MODEL, config.GOOGLE_GENERATIVE_AI_API_KEY) : null;
  const knowledge = new KnowledgeService(articles, embedder, (error) => console.error("[embeddings]", error instanceof Error ? error.message : String(error)));
  const suggestionRepository = new DrizzleSuggestionRepository(database);
  const insights = new InsightsService(new DrizzleInsightsSource(database), pricePerToken(config.LLM_MODEL), suggestionRepository);
  const writer = missingApiKey(config.LLM_MODEL, config) ? null : mastraReplyWriter;
  const replySuggestions = new ReplySuggestionService(conversations, budget, writer, suggestionRepository, config.TOTAL_AGENT_TURN_LIMIT);

  const changes = new DrizzleChangeFeed(database);

  return { employees, articles, knowledge, messages, budget, tickets, conversations, drafts, feedback, insights, replySuggestions, changes };
}

export type Services = ReturnType<typeof createServices>;
