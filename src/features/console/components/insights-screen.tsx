import { HANDOFF_REASON_LABEL } from "@/domain/conversation";
import type { Insights } from "@/domain/insights";
import { formatClock, formatSeconds, formatUsd, percent } from "@/lib/format";
import { ConsoleRail } from "./console-rail";

const dash = "—";
const pct = (value: number | null) => (value === null ? dash : percent(value));

/** Indicadores do atendimento: o que o agent resolve, por que transfere, quanto demora e quanto custa. */
export function InsightsScreen({ analystName, insights, days, generatedAt }: { analystName: string; insights: Insights; days: number; generatedAt: string }) {
  const totalHandoffs = insights.handoffs.reduce((sum, h) => sum + h.count, 0);
  const maxHandoff = Math.max(1, ...insights.handoffs.map((h) => h.count));

  return (
    <div className="flex h-screen">
      <ConsoleRail active="indicadores" analystName={analystName} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
          <header className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-serif text-3xl">Indicadores</h1>
              <p className="text-sm text-muted-foreground">
                Últimos {days} dias · atualizado às {formatClock(generatedAt)}
              </p>
            </div>
            <a href="/console/indicadores" className="text-sm font-medium text-primary hover:underline">
              Atualizar
            </a>
          </header>

          <section aria-label="Principais indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Resolvido sem analista"
              value={pct(insights.resolvedWithoutHuman)}
              detail={`${insights.conversations} conversa${insights.conversations === 1 ? "" : "s"}`}
            />
            <Tile
              label="Tempo de resposta do agent"
              value={insights.avgLatencyMs === null ? dash : formatSeconds(insights.avgLatencyMs)}
              detail={insights.p95LatencyMs === null ? "sem respostas ainda" : `95% em até ${formatSeconds(insights.p95LatencyMs)}`}
            />
            <Tile
              label='"Isso resolveu?"'
              value={pct(insights.feedback.rate)}
              detail={`${insights.feedback.helpful} sim · ${insights.feedback.notHelpful} não`}
            />
            <Tile
              label="Custo estimado"
              value={insights.costUsd === null ? dash : formatUsd(insights.costUsd)}
              detail={insights.costPerConversationUsd === null ? "sem preço ou sem respostas" : `${formatUsd(insights.costPerConversationUsd)} por conversa`}
            />
          </section>

          <section aria-label="Mais indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile small label="Respostas do agent" value={String(insights.agentTurns)} detail={`${(insights.tokens.input + insights.tokens.output).toLocaleString("pt-BR")} tokens`} />
            <Tile
              small
              label="Confiança média"
              value={insights.avgConfidence === null ? dash : percent(insights.avgConfidence)}
              detail={insights.lowConfidenceRate === null ? "sem decisões ainda" : `${percent(insights.lowConfidenceRate)} abaixo de 50%`}
            />
            <Tile
              small
              label="Rascunhos confirmados"
              value={pct(insights.drafts.confirmRate)}
              detail={`${insights.drafts.confirmed} confirmados · ${insights.drafts.cancelled} descartados · ${insights.drafts.pending} pendentes`}
            />
            <Tile small label="Analistas no service desk" value={String(insights.analysts)} detail={`${totalHandoffs} transferência${totalHandoffs === 1 ? "" : "s"}`} />
          </section>

          <section aria-labelledby="handoffs-title" className="rounded-xl border bg-surface p-5">
            <h2 id="handoffs-title" className="font-semibold">
              Transferências por motivo
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">Por que as conversas foram para um analista.</p>
            <ul className="space-y-3">
              {insights.handoffs.map(({ reason, count }) => (
                <li key={reason} className="grid grid-cols-[minmax(8rem,14rem)_1fr_2.5rem] items-center gap-3 text-sm" title={`${HANDOFF_REASON_LABEL[reason]}: ${count}`}>
                  <span className="truncate text-muted-foreground">{HANDOFF_REASON_LABEL[reason]}</span>
                  <span className="h-2.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(count / maxHandoff) * 100}%` }} />
                  </span>
                  <span className="text-right font-medium tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-muted-foreground">
            Calculado das mensagens, dos traces do agent, dos rascunhos e das avaliações gravados no banco, sem chamar o modelo. O custo é estimado pelos tokens de cada
            resposta e pela tabela de preço do modelo.
          </p>
        </div>
      </main>
    </div>
  );
}

function Tile({ label, value, detail, small = false }: { label: string; value: string; detail: string; small?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={small ? "mt-1 font-serif text-2xl" : "mt-1 font-serif text-4xl"}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
