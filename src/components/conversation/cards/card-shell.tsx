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
      <div className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{eyebrow}</span>
          {status}
        </div>
        <h4 className="text-base font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t px-4 py-3 sm:grid-cols-4">{children}</dl>
      {footer && <div className="flex items-center gap-2 border-t bg-muted/50 px-4 py-3">{footer}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}
