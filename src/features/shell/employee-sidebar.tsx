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

export function EmployeeSidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-58 shrink-0 flex-col border-r bg-surface md:flex">
      <div className="px-5 py-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
              pathname === href ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <PersonAvatar name={name} className="size-8" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <LogoutButton className="w-full" />
      </div>
    </aside>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
      }}
      className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted", className)}
    >
      <LogOut className="size-4" />
      Sair
    </button>
  );
}
