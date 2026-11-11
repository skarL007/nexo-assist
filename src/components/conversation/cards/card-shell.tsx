import { cn } from "@/lib/utils";

/** Só o código (INC-…, REQ-…, D-…) vai em fonte mono; o resto do rótulo segue no texto normal. */
const CODE = /(\b[A-Z]{1,4}-\d+\b)/;

export function CodeText({ text }: { text: string }) {
  return (
    <>
      {text.split(CODE).map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="font-mono text-[0.95em] tracking-tight">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Moldura comum dos cards de chamado e de rascunho. Os filhos usam @md: para se ajustar à largura do card. */
export function CardShell({
  eyebrow,
  status,
  title,
  description,
  children,
  footer,
  muted = false,
}: {
  eyebrow: string;
  status: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Card que já não vale (rascunho substituído ou descartado): sai do primeiro plano, mas continua legível. */
  muted?: boolean;
}) {
  return (
    <div className={cn("@container overflow-hidden rounded-2xl border bg-surface", muted ? "bg-surface/50 text-muted-foreground" : "shadow-xs")} data-muted={muted || undefined}>
      <div className="space-y-2 px-4 pt-4 pb-4 @md:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="eyebrow min-w-0">
            <CodeText text={eyebrow} />
          </span>
          <span className="shrink-0">{status}</span>
        </div>
        <h4 className="font-serif text-lg leading-snug font-semibold tracking-tight text-pretty @md:text-xl">{title}</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5 border-t bg-background/60 px-4 py-3.5 @md:grid-cols-4 @md:px-5">{children}</dl>
      {footer && <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 @md:px-5">{footer}</div>}
    </div>
  );
}

export function Field({ label, children, wrap = false, className }: { label: string; children: React.ReactNode; wrap?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="eyebrow text-[11px]">{label}</dt>
      <dd className={cn("mt-1 text-sm font-medium", !wrap && "truncate")}>{children}</dd>
    </div>
  );
}
