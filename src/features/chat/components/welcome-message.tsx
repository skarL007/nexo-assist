import { ArrowUpRight, ClipboardList, Clock, Monitor, ShieldAlert, type LucideIcon } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/brand";

const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: "Minha VPN dá erro 809", icon: ShieldAlert },
  { text: "Qual o status do meu chamado?", icon: ClipboardList },
  { text: "Preciso de um segundo monitor", icon: Monitor },
  { text: "Qual o horário do service desk?", icon: Clock },
];

/** Primeira tela de uma conversa nova: saudação grande e quatro atalhos em cartões. */
export function WelcomeMessage({ firstName, onPick }: { firstName: string; onPick: (text: string) => void }) {
  return (
    <section className="flex flex-col gap-8 pt-2 md:pt-8">
      <div className="space-y-3">
        <h1 className="font-serif text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl">Olá, {firstName}.</h1>
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="size-2 rounded-full bg-beam ring-4 ring-beam/20" />
          {PRODUCT_NAME}
        </span>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Me conte o que está acontecendo com as suas palavras. Posso tirar dúvidas, ver seus chamados, abrir um novo ou chamar um analista.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map(({ text, icon: Icon }) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="group flex items-center gap-3.5 rounded-xl border bg-surface p-3.5 text-left text-sm font-medium shadow-xs transition-colors duration-150 outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">{text}</span>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        ))}
      </div>
    </section>
  );
}
