"use client";

import { BarChart3, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Brand, BrandMark } from "@/components/nexo/brand";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { LogoutButton } from "@/features/shell/employee-sidebar";
import { cn } from "@/lib/utils";

type Section = "conversas" | "indicadores";

const NAV = [
  { id: "conversas", href: "/console", label: "Conversas", icon: MessagesSquare },
  { id: "indicadores", href: "/console/indicadores", label: "Indicadores", icon: BarChart3 },
] as const;

interface Props {
  active: Section;
  analystName: string;
  /** Conversas esperando um analista: vira o número no ícone de Conversas. */
  queueSize?: number;
}

const item = (selected: boolean, className: string) =>
  cn(
    "tap-target relative grid place-items-center outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring active:bg-black/[0.09]",
    selected ? "bg-black/[0.07] text-foreground" : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground",
    className,
  );

function NavLinks({ active, queueSize, className }: { active: Section; queueSize: number; className: string }) {
  return NAV.map(({ id, href, label, icon: Icon }) => (
    <Link key={id} href={href} className={item(active === id, className)} title={label} aria-label={label} aria-current={active === id ? "page" : undefined}>
      <Icon className="size-[18px]" strokeWidth={active === id ? 2.25 : 2} />
      {id === "conversas" && queueSize > 0 && (
        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-ink">
          {queueSize}
        </span>
      )}
    </Link>
  ));
}

/** Trilho lateral do console (a partir de 1024 px): conversas, indicadores e a conta do analista. */
export function ConsoleRail({ active, analystName, queueSize = 0 }: Props) {
  return (
    <nav className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r bg-ink/80 pb-4 text-ink-foreground backdrop-blur-xl lg:flex" aria-label="Menu">
      <span className="grid h-[72px] place-items-center">
        <BrandMark className="size-8 rounded-[10px]" />
      </span>
      <NavLinks active={active} queueSize={queueSize} className="size-10 rounded-[10px]" />
      <div className="mt-auto flex flex-col items-center gap-2">
        <span title={analystName}>
          <PersonAvatar name={analystName} className="size-8" online />
        </span>
        <LogoutButton compact className="size-10 justify-center rounded-[10px] p-0 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground" />
      </div>
    </nav>
  );
}

/** Barra do topo do console abaixo de 1024 px: a marca e os mesmos atalhos do trilho. */
export function ConsoleMobileBar({ active, queueSize = 0 }: Omit<Props, "analystName">) {
  return (
    <header className="z-20 flex h-13 shrink-0 items-center justify-between border-b bg-surface/80 pr-3 pl-4 backdrop-blur-xl lg:hidden">
      <Brand />
      <nav className="flex items-center gap-2" aria-label="Menu">
        <NavLinks active={active} queueSize={queueSize} className="size-9 rounded-full" />
        <LogoutButton compact className={item(false, "size-9 rounded-full p-0")} />
      </nav>
    </header>
  );
}
