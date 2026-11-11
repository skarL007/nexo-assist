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
        <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 md:py-12">
          <div className="flex items-center gap-4">
            <PersonAvatar name={employee.name} className="size-14 text-base [&_span]:text-base" />
            <div className="min-w-0">
              <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">Meu perfil</h1>
              <p className="text-sm text-muted-foreground">Seus dados de acesso ao service desk de TI.</p>
            </div>
          </div>

          <dl className="divide-y overflow-hidden rounded-xl border bg-surface">
            {[
              ["Nome", employee.name],
              ["E-mail corporativo", employee.email],
              ["Área", employee.department],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-4 text-sm sm:grid-cols-[11rem_1fr_auto] sm:items-center">
                <dt className="eyebrow">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
                {label === "E-mail corporativo" && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" /> Gerenciado pela TI
                  </span>
                )}
              </div>
            ))}
          </dl>

          <div className="overflow-hidden rounded-xl border bg-surface">
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-40 flex-1 text-sm">
                <p className="font-medium">Senha</p>
                <p className="text-muted-foreground">Alterada {formatRelative(employee.passwordChangedAt.toISOString())}</p>
              </div>
              <Button variant="outline" size="sm" disabled title="Fora do escopo desta demonstração">
                Redefinir senha
              </Button>
            </div>
            <p className="flex items-center gap-2 border-t bg-muted/60 px-5 py-3 text-xs text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              Enviaremos um link de redefinição para {employee.email}.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
