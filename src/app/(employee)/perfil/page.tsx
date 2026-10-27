import { KeyRound, Lock, Mail } from "lucide-react";
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
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
          <div>
            <h1 className="text-2xl font-semibold">Meu perfil</h1>
            <p className="text-sm text-muted-foreground">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <dl className="divide-y rounded-xl border bg-surface">
            {[
              ["Nome", employee.name],
              ["E-mail corporativo", employee.email],
              ["Área", employee.department],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[10rem_1fr_auto] items-center px-5 py-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
                {label === "E-mail corporativo" && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" /> Gerenciado pela TI
                  </span>
                )}
              </div>
            ))}
          </dl>

          <div className="rounded-xl border bg-surface">
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="grid size-9 place-items-center rounded-lg bg-muted">
                <KeyRound className="size-4" />
              </span>
              <div className="flex-1 text-sm">
                <p className="font-medium">Senha</p>
                <p className="text-muted-foreground">Alterada {formatRelative(employee.passwordChangedAt.toISOString())}</p>
              </div>
              <Button variant="outline" size="sm" disabled title="Fora do escopo desta demonstração">
                Redefinir senha
              </Button>
            </div>
            <p className="flex items-center gap-2 border-t bg-muted/50 px-5 py-3 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              Enviaremos um link de redefinição para {employee.email}.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
