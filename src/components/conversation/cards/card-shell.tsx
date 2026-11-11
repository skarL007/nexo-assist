import { cn } from "@/lib/utils";

/** Códigos (INC-…, REQ-…, D-…) vão em fonte mono; o resto do rótulo segue em caixa alta espaçada. */
const CODE = /\b[A-Z]{1,4}-\d+\b/;

function Eyebrow({ text }: { text: string }) {
  return (
    <span className="eyebrow min-w-0">
      {text.split(" · ").map((part, index) => (
        <span key={index}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <span className={cn(CODE.test(part) && "font-mono tracking-[0.06em]")}>{part}</span>
        </span>
      ))}
    </span>
  );
}

/** Moldura comum dos cards de chamado e de rascunho. */
export function CardShell({
  eyebrow,
  status,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  status: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-surface shadow-xs">
      <div className="space-y-2 px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <Eyebrow text={eyebrow} />
          <span className="shrink-0">{status}</span>
        </div>
        <h4 className="font-serif text-xl leading-snug font-semibold tracking-tight">{title}</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5 border-t bg-background/60 px-5 py-3.5 sm:grid-cols-4">{children}</dl>
      {footer && <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">{footer}</div>}
    </div>
  );
}

export function Field({ label, children, wrap = false }: { label: string; children: React.ReactNode; wrap?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className={cn("mt-1 text-sm font-medium", !wrap && "truncate")}>{children}</dd>
    </div>
  );
}
