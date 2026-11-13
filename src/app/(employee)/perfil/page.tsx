import { KeyRound, Lock, Mail } from "lucide-react";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shell/page-header";
import { formatRelative } from "@/lib/format";
import { requirePageUser } from "@/server/session";

export default async function ProfilePage() {
  const employee = await requirePageUser("employee");

  return (
    <>
      <PageHeader page="Meu perfil" />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 md:space-y-8 md:py-12">
          {/* O título da tela já está no cabeçalho: aqui entra a pessoa. */}
          <div className="flex items-center gap-4">
            <PersonAvatar name={employee.name} className="size-16 [&_span]:text-lg" />
            <div className="min-w-0 space-y-1">
              <h1 className="truncate font-serif text-[28px] leading-tight font-semibold tracking-[-0.02em]">{employee.name}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">Seus dados de acesso ao service desk de TI.</p>
            </div>
          </div>

          <dl className="divide-y overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]">
            {[
              ["Nome", employee.name],
              ["E-mail corporativo", employee.email],
              ["Área", employee.department],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-4 text-sm sm:grid-cols-[11rem_1fr_auto] sm:items-center">
                <dt className="text-[13px] text-muted-foreground">{label}</dt>
                <dd className="min-w-0 font-medium break-words">{value}</dd>
                {label === "E-mail corporativo" && (
                  <dd className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" /> Gerenciado pela TI
                  </dd>
                )}
              </div>
            ))}
          </dl>

          <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <KeyRound className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-40 flex-1 text-sm">
                <p className="font-medium">Senha</p>
                <p className="text-[13px] text-muted-foreground">Alterada {formatRelative(employee.passwordChangedAt.toISOString())}</p>
              </div>
              <Button variant="outline" size="sm" disabled title="Fora do escopo desta demonstração">
                Redefinir senha
              </Button>
            </div>
            <p className="flex items-start gap-2 border-t bg-background/60 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
              <Mail className="mt-0.5 size-3.5 shrink-0" />
              Enviaremos um link de redefinição para {employee.email}.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
