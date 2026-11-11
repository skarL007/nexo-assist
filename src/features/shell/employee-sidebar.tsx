"use client";

import { LogOut, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/nexo/brand";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/atendimento", label: "Atendimento", icon: MessageSquare },
  { href: "/perfil", label: "Meu perfil", icon: User },
];

/** Barra lateral do funcionário (a partir do tablet). No celular, quem aparece é a EmployeeMobileBar. */
export function EmployeeSidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-ink/80 text-ink-foreground backdrop-blur-xl md:flex">
      <div className="px-5 pt-6 pb-7">
        <Brand inverted />
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pathname === href
                ? "bg-black/[0.06] font-medium text-ink-foreground"
                : "text-ink-foreground/65 hover:bg-black/[0.04] hover:text-ink-foreground",
            )}
          >
            <Icon className={cn("size-4", pathname === href && "text-beam")} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <PersonAvatar name={name} className="size-8" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-ink-foreground/55">{email}</p>
          </div>
        </div>
        <LogoutButton className="w-full text-ink-foreground/65 hover:bg-black/[0.04] hover:text-ink-foreground" />
      </div>
    </aside>
  );
}

/** Cabeçalho do celular: a marca e o acesso a Atendimento, Meu perfil e Sair (a barra lateral não cabe). */
export function EmployeeMobileBar({ name }: { name: string }) {
  const pathname = usePathname();
  const item = (selected: boolean) =>
    cn(
      "relative grid size-9 place-items-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected ? "bg-black/[0.07] text-foreground" : "text-ink-foreground/70 hover:bg-black/[0.04] hover:text-ink-foreground",
    );

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b bg-surface/80 px-4 text-foreground backdrop-blur-xl md:hidden">
      <Brand inverted />
      <nav className="flex items-center gap-1" aria-label="Menu">
        <Link href="/atendimento" className={item(pathname === "/atendimento")} aria-label="Atendimento" aria-current={pathname === "/atendimento" ? "page" : undefined}>
          <MessageSquare className="size-4" />
        </Link>
        <Link href="/perfil" className={item(pathname === "/perfil")} aria-label="Meu perfil" aria-current={pathname === "/perfil" ? "page" : undefined} title={name}>
          <User className="size-4" />
        </Link>
        <LogoutButton compact className={item(false)} />
      </nav>
    </header>
  );
}

export function LogoutButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <LogOut className="size-4" />
      {compact ? <span className="sr-only">Sair</span> : "Sair"}
    </button>
  );
}
