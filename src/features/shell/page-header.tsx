/** Cabeçalho editorial: trilha discreta em cima, título da tela em serif e o estado à direita. */
export function PageHeader({ page, children }: { page: string; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-surface px-4 sm:px-6 md:h-16 md:px-8">
      <nav className="min-w-0" aria-label="Trilha">
        <span className="eyebrow block max-sm:hidden">Service desk de TI</span>
        <span aria-current="page" className="block truncate font-serif text-xl leading-tight font-semibold tracking-tight">
          {page}
        </span>
      </nav>
      {children}
    </header>
  );
}
