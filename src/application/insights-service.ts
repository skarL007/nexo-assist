/** Indicadores do atendimento numa janela de dias (painel do console e números do login). */
import { computeInsights, type Insights } from "@/domain/insights";
import { slaRisk, type SlaRisk } from "@/domain/sla-risk";
import { systemClock, type Clock, type InsightsSource } from "./ports";

const DAY_MS = 86_400_000;

export class InsightsService {
  constructor(
    private readonly source: InsightsSource,
    private readonly price: { input: number; output: number } | null,
    private readonly clock: Clock = systemClock,
  ) {}

  async lastDays(days: number): Promise<Insights> {
    const since = new Date(this.clock.now().getTime() - days * DAY_MS);
    const [messages, feedback, drafts, analysts] = await Promise.all([
      this.source.messagesSince(since),
      this.source.feedbackSince(since),
      this.source.draftStatusesSince(since),
      this.source.countAnalysts(),
    ]);
    return computeInsights({ messages, feedback, drafts, analysts, price: this.price });
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
