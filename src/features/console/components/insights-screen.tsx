import { ChevronDown, ChevronRight, RotateCw } from "lucide-react";
import { StatusPill } from "@/components/nexo/status-pill";
import { Button } from "@/components/ui/button";
import { HANDOFF_REASON_LABEL } from "@/domain/conversation";
import type { InsightsReport } from "@/domain/insights";
import type { ResolutionSummary } from "@/domain/resolution";
import type { SlaRisk } from "@/domain/sla-risk";
import { explainSla } from "@/lib/sla-text";
import { formatClock, formatSeconds, formatUsd, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConsoleMobileBar, ConsoleRail } from "./console-rail";

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
    <div className="flex h-dvh flex-col lg:flex-row">
      <ConsoleMobileBar active="indicadores" />
      <ConsoleRail active="indicadores" analystName={analystName} />
      <main className="scrollbar-quiet flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-10 md:space-y-8">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div>
              <h1 className="font-serif text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">Indicadores</h1>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                Últimos {days} dias · atualizado às {formatClock(generatedAt)}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/console/indicadores">
                <RotateCw /> Atualizar
              </a>
            </Button>
          </header>

          {/* Cada cartão ocupa três linhas da grade (rótulo, valor, detalhe): os valores ficam na mesma altura mesmo quando um rótulo quebra em duas linhas. */}
          <section aria-label="Principais indicadores" className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Tile label="“Isso resolveu?”" value={pct(insights.feedback.rate)} detail={`${insights.feedback.helpful} sim · ${insights.feedback.notHelpful} não`} />
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

          <section aria-label="Mais indicadores" className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4 md:grid-cols-3 lg:grid-cols-5">
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

          <Panel id="sla-title" title="Prazos em risco agora" description="Chamados abertos vencidos ou com 75% ou mais do prazo usado, com a conta do prazo.">
            {slaQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chamado com prazo em risco.</p>
            ) : (
              <ul className="divide-y">
                {slaQueue.map((risk) => {
                  const text = explainSla(risk);
                  return (
                    <li key={risk.code} className="py-3.5 text-sm first:pt-0 last:pb-0">
                      <details className="group">
                        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface">
                          <StatusPill tone={risk.level === "overdue" ? "danger" : "warning"}>{risk.level === "overdue" ? "Vencido" : "Em risco"}</StatusPill>
                          <span className="font-medium">{text.headline}</span>
                          <span className="min-w-0 text-muted-foreground">
                            {risk.title} · {risk.ownerName}
                          </span>
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-beam-soft pr-1.5 pl-2 text-xs font-medium whitespace-nowrap text-beam-foreground transition-colors duration-150 group-open:bg-beam group-open:text-[oklch(0.3_0.06_70)] sm:ml-auto">
                            por quê? <ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
                          </span>
                        </summary>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
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
          </Panel>

          <Panel id="handoffs-title" title="Transferências por motivo" description="Por que as conversas foram para um analista.">
            <ul className="space-y-3.5 sm:space-y-3">
              {insights.handoffs.map(({ reason, count }) => (
                <BarRow key={reason} label={HANDOFF_REASON_LABEL[reason]} count={count} max={maxHandoff} tone="primary" />
              ))}
            </ul>
          </Panel>

          <p className="max-w-3xl text-xs leading-relaxed text-pretty text-muted-foreground">
            Calculado das mensagens, dos traces do agent, dos rascunhos e das avaliações gravados no banco, sem chamar o modelo. O custo é estimado pelos tokens de cada
            resposta e pela tabela de preço do modelo.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Seção em cartão branco com título e uma linha de contexto. */
function Panel({ id, title, description, children }: { id: string; title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
      <h2 id={id} className="font-serif text-xl leading-tight font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 mb-5 max-w-3xl text-[13px] leading-relaxed text-pretty text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

/** Linha de barra: rótulo, barra proporcional e a contagem. No celular o rótulo fica em cima da barra (inteiro, sem cortar). */
function BarRow({ label, count, max, tone, children }: { label: string; count: number; max: number; tone: "primary" | "neutral"; children?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1fr_2.5rem] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[minmax(8rem,16.5rem)_1fr_2.5rem]" title={`${label}: ${count}`}>
      <span className="leading-snug text-muted-foreground max-sm:col-span-2">
        {label}
        {children}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-muted-foreground/45")}
          style={{ width: count === 0 ? 0 : `${Math.max(1.5, (count / max) * 100)}%` }}
        />
      </span>
      <span className="text-right font-medium tabular-nums">{count}</span>
    </li>
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
    <Panel
      id="resolution-title"
      title="Resolução honesta"
      description={
        <>
          Resolvida = confirmada ou presumida. “Sem analista” seria {pct(withoutHuman)}, mas conta chamado aberto, pergunta sem resposta e quem voltou com o mesmo problema.
        </>
      }
    >
      <ul className="space-y-3.5 sm:space-y-3">
        {RESOLUTION_ROWS.map((row) => (
          <BarRow key={row.key} label={row.label} count={resolution[row.key] as number} max={max} tone={row.resolved ? "primary" : "neutral"}>
            {row.resolved && <span className="sr-only"> (conta como resolvida)</span>}
          </BarRow>
        ))}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> conta como resolvida
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/45" /> não conta
        </span>
      </p>
      <details className="group mt-4 border-t pt-4 text-xs">
        <summary className="tap-target flex w-fit cursor-pointer items-center gap-1 rounded text-[13px] font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
          Como contamos
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 leading-relaxed text-muted-foreground sm:grid-cols-[10rem_1fr]">
          {RESOLUTION_ROWS.map((row) => (
            <div key={row.key} className="sm:contents">
              <dt className="font-medium text-foreground">{row.label}</dt>
              <dd>{row.definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Panel>
  );
}

function GapsSection({ gaps }: { gaps: InsightsReport["knowledgeGaps"] }) {
  return (
    <Panel
      id="gaps-title"
      title="Lacunas da central"
      description="Temas que o agent buscou e não achou artigo (3 ou mais vezes). Candidatos a artigo novo. E-mails, CPFs e números aparecem mascarados."
    >
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma lacuna recorrente.</p>
      ) : (
        <ul className="divide-y">
          {gaps.map((gap) => (
            <li key={gap.terms.join("-")} className="py-3.5 text-sm first:pt-0 last:pb-0">
              <p className="leading-relaxed">
                <span className="font-medium">{gap.terms.join(", ")}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {gap.searches} buscas sem artigo · {percent(gap.escalatedRate)} viraram chamado ou analista
                </span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Exemplo: “{gap.example}”</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Tile({ label, value, detail, small = false }: { label: string; value: string; detail: string; small?: boolean }) {
  return (
    <div className="row-span-3 grid grid-rows-subgrid gap-y-2 rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <p className="eyebrow leading-snug text-pretty">{label}</p>
      <p
        className={cn(
          "self-end font-serif leading-none font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums",
          small ? "text-[28px]" : "text-[34px] lg:text-4xl",
          value === dash && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-xs leading-relaxed text-pretty text-muted-foreground">{detail}</p>
    </div>
  );
}
