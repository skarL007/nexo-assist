/**
 * Composition root: o único lugar que liga as peças (repositórios → serviços).
 * As rotas e o agent pedem `createServices()` e recebem tudo pronto.
 */
import { ConversationService } from "@/application/conversation-service";
import { DraftService } from "@/application/draft-service";
import { FeedbackService } from "@/application/feedback-service";
import { InsightsService } from "@/application/insights-service";
import { TicketService } from "@/application/ticket-service";
import { pricePerToken } from "@/agent/model-config";
import { env } from "@/config/env";
import { db } from "./db/client";
import { FlakyTicketRepository } from "./legacy-ticket-system";
import { DrizzleBudgetRepository } from "./repositories/budget-repository";
import { DrizzleConversationRepository } from "./repositories/conversation-repository";
import { DrizzleDraftRepository } from "./repositories/draft-repository";
import { DrizzleArticleRepository, DrizzleEmployeeRepository } from "./repositories/employee-repository";
import { DrizzleFeedbackRepository } from "./repositories/feedback-repository";
import { DrizzleInsightsSource } from "./repositories/insights-source";
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
  const insights = new InsightsService(new DrizzleInsightsSource(database), pricePerToken(env().LLM_MODEL));

  return { employees, articles, messages, budget, tickets, conversations, drafts, feedback, insights };
}

export type Services = ReturnType<typeof createServices>;
