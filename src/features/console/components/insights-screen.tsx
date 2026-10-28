import { HANDOFF_REASON_LABEL } from "@/domain/conversation";
import type { InsightsReport } from "@/domain/insights";
import type { ResolutionSummary } from "@/domain/resolution";
import type { SlaRisk } from "@/domain/sla-risk";
import { explainSla } from "@/lib/sla-text";
import { formatClock, formatSeconds, formatUsd, percent } from "@/lib/format";
import { ConsoleRail } from "./console-rail";

const dash = "—";
const pct = (value: number | null) => (value === null ? dash : percent(value));

/** Indicadores do atendimento: o que o agent resolve, por que transfere, quanto demora e quanto custa. */
export function InsightsScreen({
  analystName,
  insights,
  slaQueue,
  days,
  generatedAt,
}: {
  analystName: string;
  insights: InsightsReport;
  slaQueue: (SlaRisk & { ownerName: string })[];
  days: number;
  generatedAt: string;
}) {
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
              label="Resolvido pelo agent"
              value={pct(insights.resolution.rate)}
              detail={`${insights.resolution.confirmed} confirmadas · ${insights.resolution.presumed} presumidas · ${insights.resolution.total} conversas`}
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
              detail={
                insights.costPerConversationUsd === null
                  ? "sem preço ou sem respostas"
                  : `${formatUsd(insights.costPerConversationUsd)} por conversa · ${insights.resolution.costPerResolutionUsd === null ? dash : formatUsd(insights.resolution.costPerResolutionUsd)} por resolução`
              }
            />
          </section>

          <section aria-label="Mais indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <Tile
              small
              label="Sugestões enviadas sem editar"
              value={pct(insights.suggestions.asIsRate)}
              detail={`${insights.suggestions.generated} geradas · ${insights.suggestions.sentAsIs} iguais · ${insights.suggestions.sentEdited} editadas`}
            />
            <Tile small label="Analistas no service desk" value={String(insights.analysts)} detail={`${totalHandoffs} transferência${totalHandoffs === 1 ? "" : "s"}`} />
          </section>

          <ResolutionSection resolution={insights.resolution} withoutHuman={insights.resolvedWithoutHuman} />

          <GapsSection gaps={insights.knowledgeGaps} />

          <section aria-labelledby="sla-title" className="rounded-xl border bg-surface p-5">
            <h2 id="sla-title" className="font-semibold">
              Prazos em risco agora
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">Chamados abertos vencidos ou com 75% ou mais do prazo usado, com a conta do prazo.</p>
            {slaQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chamado com prazo em risco.</p>
            ) : (
              <ul className="divide-y">
                {slaQueue.map((risk) => {
                  const text = explainSla(risk);
                  return (
                    <li key={risk.code} className="py-3 text-sm">
                      <details>
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                          <span className={risk.level === "overdue" ? "font-medium text-danger" : "font-medium text-amber-800"}>
                            {risk.level === "overdue" ? "Vencido" : "Em risco"}
                          </span>
                          <span className="font-medium">{text.headline}</span>
                          <span className="text-muted-foreground">
                            {risk.title} · {risk.ownerName}
                          </span>
                          <span className="text-xs text-primary">por quê?</span>
                        </summary>
                        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                          {text.lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
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

/** Grupos da resolução honesta, na ordem em que aparecem (o que conta como resolvido primeiro). */
const RESOLUTION_ROWS: { key: keyof ResolutionSummary; label: string; resolved?: boolean; definition: string }[] = [
  { key: "confirmed", label: "Confirmadas", resolved: true, definition: 'O funcionário respondeu "sim" no "Isso resolveu?" (vale a última avaliação).' },
  { key: "presumed", label: "Presumidas", resolved: true, definition: "Saiu sem pedir mais nada depois da resposta: sem analista, sem chamado, sem pergunta do agent no fim." },
  { key: "ticket", label: "Viraram chamado", definition: "Rascunho confirmado. É um bom encaminhamento, mas o problema não foi resolvido na conversa." },
  { key: "inProgress", label: "Em andamento", definition: "Há um rascunho esperando o funcionário confirmar." },
  { key: "reopened", label: "Reabertas", definition: "A mesma pessoa voltou com o mesmo assunto em até 7 dias. Deixa de contar como resolvida." },
  { key: "notResolved", label: "Não resolveram", definition: 'A última avaliação do "Isso resolveu?" foi "não".' },
  { key: "abandoned", label: "Abandonadas", definition: "Terminou com o agent perguntando algo (ou sem resposta) e a pessoa não voltou." },
  { key: "human", label: "Com analista", definition: "Teve transferência ou resposta de um analista." },
];

function ResolutionSection({ resolution, withoutHuman }: { resolution: ResolutionSummary; withoutHuman: number | null }) {
  const max = Math.max(1, ...RESOLUTION_ROWS.map((row) => resolution[row.key] as number));
  return (
    <section aria-labelledby="resolution-title" className="rounded-xl border bg-surface p-5">
      <h2 id="resolution-title" className="font-semibold">
        Resolução honesta
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Resolvida = confirmada ou presumida. “Sem analista” seria {pct(withoutHuman)}, mas conta chamado aberto, pergunta sem resposta e quem voltou com o mesmo problema.
      </p>
      <ul className="space-y-3">
        {RESOLUTION_ROWS.map((row) => {
          const count = resolution[row.key] as number;
          return (
            <li key={row.key} className="grid grid-cols-[minmax(8rem,14rem)_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground">
                {row.label}
                {row.resolved && <span className="sr-only"> (conta como resolvida)</span>}
              </span>
              <span className="h-2.5 rounded-full bg-muted">
                <span className={row.resolved ? "block h-full rounded-full bg-primary" : "block h-full rounded-full bg-muted-foreground/40"} style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums">{count}</span>
            </li>
          );
        })}
      </ul>
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer font-medium text-primary">Como contamos</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-[10rem_1fr]">
          {RESOLUTION_ROWS.map((row) => (
            <div key={row.key} className="contents">
              <dt className="font-medium text-foreground">{row.label}</dt>
              <dd>{row.definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

function GapsSection({ gaps }: { gaps: InsightsReport["knowledgeGaps"] }) {
  return (
    <section aria-labelledby="gaps-title" className="rounded-xl border bg-surface p-5">
      <h2 id="gaps-title" className="font-semibold">
        Lacunas da central
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Temas que o agent buscou e não achou artigo (3 ou mais vezes). Candidatos a artigo novo. E-mails, CPFs e números aparecem mascarados.
      </p>
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma lacuna recorrente.</p>
      ) : (
        <ul className="divide-y">
          {gaps.map((gap) => (
            <li key={gap.terms.join("-")} className="py-3 text-sm">
              <p>
                <span className="font-medium">{gap.terms.join(", ")}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {gap.searches} buscas sem artigo · {percent(gap.escalatedRate)} viraram chamado ou analista
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Exemplo: “{gap.example}”</p>
            </li>
          ))}
        </ul>
      )}
    </section>
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
