import { ChevronRight } from "lucide-react";

/** Cabeçalho com trilha: "Service desk de TI › Atendimento". */
export function PageHeader({ page, children }: { page: string; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-surface px-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Trilha">
        Service desk de TI
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{page}</span>
      </nav>
      {children}
    </header>
  );
}
