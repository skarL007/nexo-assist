"use client";

import { BarChart3, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/nexo/brand";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { LogoutButton } from "@/features/shell/employee-sidebar";
import { cn } from "@/lib/utils";

/** Barra lateral do console: conversas e indicadores. O item ativo leva a marca âmbar do farol. */
export function ConsoleRail({ active, analystName, queueSize = 0 }: { active: "conversas" | "indicadores"; analystName: string; queueSize?: number }) {
  const item = (selected: boolean) =>
    cn(
      "relative grid size-10 place-items-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-beam",
      selected ? "bg-black/[0.07] text-foreground" : "text-ink-foreground/60 hover:bg-black/[0.04] hover:text-ink-foreground",
    );
  const bar = (selected: boolean) =>
    selected && <span aria-hidden className="absolute top-2 bottom-2 -left-2 w-[3px] rounded-r-full bg-beam" />;
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-3 border-r bg-ink/80 py-4 text-ink-foreground backdrop-blur-xl">
      <BrandMark className="mb-3" />
      <Link href="/console" className={item(active === "conversas")} title="Conversas" aria-label="Conversas" aria-current={active === "conversas" ? "page" : undefined}>
        {bar(active === "conversas")}
        <MessagesSquare className="size-[18px]" />
        {queueSize > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-beam px-1 text-[10px] leading-4 font-bold text-beam-foreground">
            {queueSize}
          </span>
        )}
      </Link>
      <Link
        href="/console/indicadores"
        className={item(active === "indicadores")}
        title="Indicadores"
        aria-label="Indicadores"
        aria-current={active === "indicadores" ? "page" : undefined}
      >
        {bar(active === "indicadores")}
        <BarChart3 className="size-[18px]" />
      </Link>
      <div className="mt-auto flex flex-col items-center gap-2">
        <PersonAvatar name={analystName} className="size-8" online />
        <LogoutButton compact className="px-2 text-ink-foreground/60 hover:bg-black/[0.04] hover:text-ink-foreground" />
      </div>
    </nav>
  );
}
