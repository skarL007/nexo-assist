import { AlertTriangle, Check, ChevronRight, ShieldCheck, X } from "lucide-react";
import { INTENT_LABEL, type RetrievalTrace, type ToolCallLog, type TurnTrace } from "@/domain/message";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * O "porquê" de cada resposta: o que o agent entendeu, com que segurança,
 * que passos deu, que regras do sistema agiram e quanto custou.
 * É a assinatura do produto: um painel "iluminado", com o topo âmbar do feixe.
 */
export function DecisionDetails({ trace }: { trace: TurnTrace }) {
  const { decision } = trace;

  return (
    <div
      className="overflow-hidden rounded-xl border border-beam/40 border-t-[3px] border-t-beam bg-surface text-sm shadow-[0_10px_30px_-14px_oklch(0.83_0.145_82/0.55)]"
      data-testid="decision-details"
    >
      {decision ? (
        <dl className="divide-y divide-border/70">
          <Row label="Entendeu" className="bg-beam-soft/40">
            <dd className="font-serif text-[17px] leading-snug tracking-tight">{decision.understanding}</dd>
          </Row>
          <Row label="Intenção">
            <dd>
              <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                {INTENT_LABEL[decision.intent]}
              </span>
            </dd>
          </Row>
          <Row label="Segurança">
            <dd className="flex items-center gap-3">
              <ConfidenceBar value={decision.confidence} />
              <span className="font-mono text-sm font-medium tabular-nums">{percent(decision.confidence)}</span>
            </dd>
          </Row>
          <Row label="Por quê">
            <dd className="leading-relaxed text-foreground/90">{decision.reasoning}</dd>
          </Row>
        </dl>
      ) : (
        <p className="bg-beam-soft/40 px-5 py-4 text-muted-foreground">Ação executada pelo sistema, sem decisão do modelo.</p>
      )}

      <div className="divide-y divide-border/70 border-t border-border/70">
        {trace.steps.length > 0 && (
          <Section title="Ações">
            <ol className="space-y-2">
              {trace.steps.map((step, index) => (
                <li key={index} className="flex gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                      step.ok ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger-foreground",
                    )}
                  >
                    {step.ok ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="font-medium">{step.label}</span>
                    {step.detail && <span className="text-muted-foreground"> — {step.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {trace.guardrails.length > 0 && (
          <Section title="Regras do sistema">
            <ul className="space-y-2">
              {trace.guardrails.map((rule, index) => (
                <li key={index} className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  {rule}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Telemetry trace={trace} />

        {trace.toolCalls.length > 0 && (
          <div className="px-5 py-4">
            <details className="group text-xs">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                Log técnico ({trace.toolCalls.length} chamadas de ferramenta)
              </summary>
              <div className="mt-3 space-y-3">
                {trace.toolCalls.map((call, index) => (
                  <ToolCallBlock key={index} call={call} />
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/70 bg-muted/50 px-5 py-3 text-xs text-muted-foreground">
        {trace.model && (
          <span>
            Modelo: <span className="font-mono text-foreground/80">{trace.model}</span>
          </span>
        )}
        {trace.usage && (
          <span>
            Tokens: <span className="font-mono text-foreground/80">{trace.usage.inputTokens}</span> entrada ·{" "}
            <span className="font-mono text-foreground/80">{trace.usage.outputTokens}</span> saída
          </span>
        )}
        <span>
          Tempo: <span className="font-mono text-foreground/80">{(trace.latencyMs / 1000).toFixed(1)}s</span>
        </span>
        {trace.fallbackFrom && <span className="text-warning-foreground">Reserva: {trace.fallbackFrom} falhou</span>}
      </footer>
    </div>
  );
}

function Row({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-1.5 px-5 py-3.5 sm:grid-cols-[6.5rem_1fr] sm:gap-4", className)}>
      <dt className="eyebrow pt-0.5">{label}</dt>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 px-5 py-4 sm:grid-cols-[6.5rem_1fr] sm:gap-4">
      <h5 className="eyebrow pt-0.5">{title}</h5>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2) ?? "—";

/** Entrada e saída de uma ferramenta, em bloco mono sobre o azul-noite. */
function ToolCallBlock({ call }: { call: ToolCallLog }) {
  return (
    <div className="overflow-hidden rounded-lg bg-ink text-ink-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 font-mono text-[11px]">
        <span className="font-medium text-beam">{call.tool}</span>
        <span className="text-ink-foreground/55 tabular-nums">{call.durationMs} ms</span>
      </div>
      {(
        [
          ["entrada", call.input],
          ["saída", call.output],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="border-b border-white/5 px-3 py-2 last:border-b-0">
          <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-foreground/45 uppercase">{label}</p>
          <pre className="scrollbar-quiet max-h-48 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-foreground/90">{asJson(value)}</pre>
        </div>
      ))}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const tone = value >= 0.75 ? "bg-success" : value >= 0.5 ? "bg-warning" : "bg-danger";
  return (
    <span className="block h-2 w-32 overflow-hidden rounded-full bg-border" aria-hidden>
      <span className={cn("block h-full rounded-full", tone)} style={{ width: percent(value) }} />
    </span>
  );
}

const VERDICT_LABEL: Record<NonNullable<RetrievalTrace["verdict"]>, string> = { applies: "se aplica", maybe: "talvez", none: "nenhum se aplica" };
const decimal = (value: number) => value.toFixed(2).replace(".", ",");

/**
 * Telemetria do turno: o id para achar os spans no coletor (OpenTelemetry/Langfuse), o tempo de
 * cada ferramenta e o raio-X de cada busca na central. Traces antigos não têm id nem raio-X.
 */
function Telemetry({ trace }: { trace: TurnTrace }) {
  const slowest = Math.max(1, ...trace.toolCalls.map((c) => c.durationMs));
  if (!trace.traceId && !trace.toolCalls.length && !trace.retrievals?.length) return null;

  return (
    <section className="grid gap-2 px-5 py-4 sm:grid-cols-[6.5rem_1fr] sm:gap-4" data-testid="turn-telemetry">
      <h5 className="eyebrow pt-0.5">Telemetria</h5>
      <div className="min-w-0 space-y-4">
        {trace.traceId && (
          <p className="text-xs text-muted-foreground">
            Trace <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground select-all">{trace.traceId}</code>
          </p>
        )}

        {trace.toolCalls.length > 0 && (
          <ol className="space-y-1.5 text-xs" aria-label="Tempo de cada ferramenta">
            {trace.toolCalls.map((call, index) => (
              <li key={index} className="grid grid-cols-[minmax(0,9rem)_1fr_4rem] items-center gap-3">
                <span className="truncate font-mono">{call.tool}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <span
                    className={cn("block h-full rounded-full", call.durationMs === slowest && trace.toolCalls.length > 1 ? "bg-beam" : "bg-primary")}
                    style={{ width: `${Math.max(2, (call.durationMs / slowest) * 100)}%` }}
                  />
                </span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">{call.durationMs} ms</span>
              </li>
            ))}
          </ol>
        )}

        {trace.retrievals?.map((retrieval, index) => <RetrievalDetails key={index} retrieval={retrieval} />)}
      </div>
    </section>
  );
}

function RetrievalDetails({ retrieval }: { retrieval: RetrievalTrace }) {
  return (
    <div className="space-y-2.5 rounded-lg border bg-background p-3.5 text-xs" data-testid="retrieval-details">
      <p>
        <span className="font-medium">Busca na central</span> <span className="text-muted-foreground">“{retrieval.query}”</span>
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        <span>{retrieval.mode === "hybrid" ? `Híbrida · ${retrieval.embeddingModel}` : "Só palavras"}</span>
        <span>{retrieval.judgeModel ? `Avaliador ${retrieval.judgeModel}: ${retrieval.verdict ? VERDICT_LABEL[retrieval.verdict] : "—"}` : "Sem avaliador (regra de margem)"}</span>
        <span className="font-mono tabular-nums">{retrieval.latencyMs} ms</span>
      </p>
      {retrieval.degraded.map((reason) => (
        <p key={reason} className="flex gap-1.5 text-warning-foreground">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {reason}
        </p>
      ))}
      {retrieval.candidates.length > 0 ? (
        <table className="w-full text-left">
          <thead>
            <tr className="eyebrow text-[10px]">
              <th className="py-1.5 font-semibold">Candidato</th>
              <th className="py-1.5 text-right font-semibold">Sentido</th>
              <th className="py-1.5 pl-3 font-semibold">Termos</th>
            </tr>
          </thead>
          <tbody>
            {retrieval.candidates.map((candidate) => {
              const chosen = retrieval.chosen.includes(candidate.id);
              return (
                <tr key={candidate.id} className={cn("border-t", chosen && "font-medium")}>
                  <td className="py-1.5">
                    {chosen && <Check className="mr-1 inline size-3.5 text-success-foreground" aria-label="devolvido ao agent" />}
                    {candidate.title}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{candidate.similarity === null ? "—" : decimal(candidate.similarity)}</td>
                  <td className="py-1.5 pl-3 font-normal text-muted-foreground">{candidate.terms.join(", ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground">Nenhum candidato.</p>
      )}
    </div>
  );
}
