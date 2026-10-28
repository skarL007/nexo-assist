/** Indicadores do atendimento numa janela de dias (painel do console e números do login). */
import { computeInsights, type InsightsReport } from "@/domain/insights";
import { findKnowledgeGaps, helpCenterSearches } from "@/domain/knowledge-gaps";
import { classifyResolutions, summarizeResolutions, type ConversationFacts } from "@/domain/resolution";
import { slaRisk, type SlaRisk } from "@/domain/sla-risk";
import { systemClock, type Clock, type InsightsSource, type SuggestionRepository } from "./ports";

const DAY_MS = 86_400_000;

export class InsightsService {
  constructor(
    private readonly source: InsightsSource,
    private readonly price: { input: number; output: number } | null,
    private readonly suggestions: Pick<SuggestionRepository, "countsSince"> | null = null,
    private readonly clock: Clock = systemClock,
  ) {}

  async lastDays(days: number): Promise<InsightsReport> {
    const since = new Date(this.clock.now().getTime() - days * DAY_MS);
    const [messages, feedback, drafts, analysts, suggestions] = await Promise.all([
      this.source.messagesSince(since),
      this.source.feedbackSince(since),
      this.source.draftStatusesSince(since),
      this.source.countAnalysts(),
      this.suggestions?.countsSince(since) ?? null,
    ]);
    const insights = computeInsights({ messages, feedback, drafts, analysts, price: this.price, suggestions });

    // Resolução honesta e lacunas: precisam da conversa inteira (dono, avaliações, rascunhos).
    const byConversation = Map.groupBy(messages, (m) => m.conversationId);
    const owners = await this.source.conversationOwners([...byConversation.keys()]);
    const facts: ConversationFacts[] = owners.map(({ id, employeeId }) => ({
      id,
      employeeId,
      messages: (byConversation.get(id) ?? []).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
      feedback: feedback.filter((f) => f.conversationId === id),
      drafts: drafts.filter((d) => d.conversationId === id).map((d) => d.status),
    }));
    const outcomes = classifyResolutions(facts);
    return {
      ...insights,
      resolution: summarizeResolutions(outcomes, insights.costUsd),
      knowledgeGaps: findKnowledgeGaps(helpCenterSearches(facts, outcomes)),
    };
  }

  /** Chamados de todo mundo com prazo vencido ou em risco: vencidos primeiro, o mais atrasado no topo. */
  async slaQueue(): Promise<(SlaRisk & { ownerName: string })[]> {
    const now = this.clock.now();
    return (await this.source.openTickets())
      .flatMap((t) => {
        const risk = slaRisk(t, now);
        return risk ? [{ ...risk, ownerName: t.ownerName }] : [];
      })
      .sort((a, b) => (a.level === b.level ? (a.level === "overdue" ? b.overdueMs - a.overdueMs : a.remainingMs - b.remainingMs) : a.level === "overdue" ? -1 : 1));
  }
}
