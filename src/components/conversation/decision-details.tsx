import { Check, ShieldCheck, X } from "lucide-react";
import { INTENT_LABEL, type TurnTrace } from "@/domain/message";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * O "porquê" de cada resposta: o que o agent entendeu, com que segurança,
 * que passos deu, que regras do sistema agiram e quanto custou.
 */
export function DecisionDetails({ trace }: { trace: TurnTrace }) {
  const { decision } = trace;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/40 p-4 text-sm" data-testid="decision-details">
      {decision ? (
        <dl className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">Entendeu</dt>
          <dd>{decision.understanding}</dd>

          <dt className="text-muted-foreground">Intenção</dt>
          <dd>
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {INTENT_LABEL[decision.intent]}
            </span>
          </dd>

          <dt className="text-muted-foreground">Segurança</dt>
          <dd className="flex items-center gap-2">
            <ConfidenceBar value={decision.confidence} />
            <span className="font-medium tabular-nums">{percent(decision.confidence)}</span>
          </dd>

          <dt className="text-muted-foreground">Por quê</dt>
          <dd>{decision.reasoning}</dd>
        </dl>
      ) : (
        <p className="text-muted-foreground">Ação executada pelo sistema, sem decisão do modelo.</p>
      )}

      {trace.steps.length > 0 && (
        <section>
          <h5 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ações</h5>
          <ol className="space-y-1.5">
            {trace.steps.map((step, index) => (
              <li key={index} className="flex gap-2">
                {step.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <X className="mt-0.5 size-4 shrink-0 text-danger" />}
                <span>
                  <span className="font-medium">{step.label}</span>
                  {step.detail && <span className="text-muted-foreground"> — {step.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {trace.guardrails.length > 0 && (
        <section>
          <h5 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Regras do sistema</h5>
          <ul className="space-y-1.5">
            {trace.guardrails.map((rule, index) => (
              <li key={index} className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                {rule}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        {trace.model && <span>Modelo: {trace.model}</span>}
        {trace.usage && (
          <span>
            Tokens: {trace.usage.inputTokens} entrada · {trace.usage.outputTokens} saída
          </span>
        )}
        <span>Tempo: {(trace.latencyMs / 1000).toFixed(1)}s</span>
      </footer>

      {trace.toolCalls.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Log técnico ({trace.toolCalls.length} chamadas de ferramenta)</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-navy p-3 font-mono text-[11px] leading-relaxed text-navy-foreground">
            {JSON.stringify(trace.toolCalls, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const tone = value >= 0.75 ? "bg-success" : value >= 0.5 ? "bg-warning" : "bg-danger";
  return (
    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-border" aria-hidden>
      <span className={cn("block h-full rounded-full", tone)} style={{ width: percent(value) }} />
    </span>
  );
}
