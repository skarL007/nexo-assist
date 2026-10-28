"use client";

import { BarChart3, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/nexo/brand";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { LogoutButton } from "@/features/shell/employee-sidebar";
import { cn } from "@/lib/utils";

/** Barra lateral do console: conversas e indicadores. */
export function ConsoleRail({ active, analystName, queueSize = 0 }: { active: "conversas" | "indicadores"; analystName: string; queueSize?: number }) {
  const item = (selected: boolean) =>
    cn("relative grid size-9 place-items-center rounded-md", selected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted");
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-4 border-r bg-surface py-4">
      <BrandMark />
      <Link href="/console" className={item(active === "conversas")} title="Conversas" aria-label="Conversas" aria-current={active === "conversas" ? "page" : undefined}>
        <MessagesSquare className="size-4" />
        {queueSize > 0 && (
          <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
        <BarChart3 className="size-4" />
      </Link>
      <div className="mt-auto flex flex-col items-center gap-2">
        <PersonAvatar name={analystName} className="size-8" online />
        <LogoutButton className="px-2" />
      </div>
    </nav>
  );
}
