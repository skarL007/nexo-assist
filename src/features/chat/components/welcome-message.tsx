import { ArrowUpRight, ClipboardList, Clock, Monitor, ShieldAlert, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/nexo/brand";

const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: "Minha VPN dá erro 809", icon: ShieldAlert },
  { text: "Qual o status do meu chamado?", icon: ClipboardList },
  { text: "Preciso de um segundo monitor", icon: Monitor },
  { text: "Qual o horário do service desk?", icon: Clock },
];

/** Primeira tela de uma conversa nova: saudação grande e quatro atalhos em cartões. */
export function WelcomeMessage({ firstName, onPick }: { firstName: string; onPick: (text: string) => void }) {
  return (
    <section className="my-auto flex flex-col items-center gap-9 py-6 text-center md:gap-10 md:pb-16">
      <div className="flex flex-col items-center gap-4">
        <BrandMark className="size-14 rounded-[16px] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] [&_svg]:size-8" />
        <h1 className="font-serif text-[38px] leading-[1.05] font-semibold tracking-[-0.03em] md:text-[52px]">Olá, {firstName}.</h1>
        <p className="max-w-[36rem] text-base leading-relaxed text-balance text-muted-foreground md:text-[17px]">
          Me conte o que está acontecendo com as suas palavras. Posso tirar dúvidas, ver seus chamados, abrir um novo ou chamar um analista.
        </p>
      </div>
      <div className="grid w-full gap-2.5 text-left sm:grid-cols-2">
        {SUGGESTIONS.map(({ text, icon: Icon }) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="group flex items-center gap-3.5 rounded-2xl bg-surface p-3.5 text-left text-[15px] font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,scale] duration-200 outline-none hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_24px_-10px_rgba(0,0,0,0.18)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
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
