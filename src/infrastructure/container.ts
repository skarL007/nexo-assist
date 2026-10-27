/**
 * Composition root: o único lugar que liga as peças (repositórios → serviços).
 * As rotas e o agent pedem `createServices()` e recebem tudo pronto.
 */
import { ConversationService } from "@/application/conversation-service";
import { DraftService } from "@/application/draft-service";
import { TicketService } from "@/application/ticket-service";
import { env } from "@/config/env";
import { db } from "./db/client";
import { FlakyTicketRepository } from "./legacy-ticket-system";
import { DrizzleConversationRepository } from "./repositories/conversation-repository";
import { DrizzleDraftRepository } from "./repositories/draft-repository";
import { DrizzleArticleRepository, DrizzleEmployeeRepository } from "./repositories/employee-repository";
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
  const legacyTickets = new FlakyTicketRepository(new DrizzleTicketRepository(database), env().LEGACY_FAILURE_RATE);

  const tickets = new TicketService(legacyTickets, { onRetry: options.onLegacyRetry });
  const conversations = new ConversationService(new DrizzleConversationRepository(database), messages);
  const drafts = new DraftService(new DrizzleDraftRepository(database), tickets, conversations, messages);

  return { employees, articles, messages, tickets, conversations, drafts };
}

export type Services = ReturnType<typeof createServices>;
