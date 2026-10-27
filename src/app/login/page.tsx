import { redirect } from "next/navigation";
import { Brand } from "@/components/nexo/brand";
import { LoginForm } from "@/features/auth/login-form";
import { currentUser, homeFor } from "@/server/session";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-12 text-navy-foreground lg:flex">
        <Brand inverted />

        <div className="max-w-md space-y-6">
          <p className="text-xs tracking-[0.2em] text-navy-foreground/60 uppercase">Service desk de TI da Nexo</p>
          <h1 className="font-serif text-5xl leading-tight">Seu problema de TI, resolvido em uma conversa.</h1>
          <p className="text-navy-foreground/70">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista
            quando precisa.
          </p>
          <ChatPreview />
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          <Stat value="8 s" label="primeira resposta, em média" />
          <Stat value="72%" label="resolvido sem fila" />
          <Stat value="6" label="analistas online agora" />
        </dl>
      </section>

      <section className="flex flex-col bg-surface p-6 sm:p-12">
        <p className="text-right text-sm text-muted-foreground">
          Problema para entrar? <span className="font-medium text-primary">Ligue no ramal 4000</span>
        </p>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-4xl">Entrar</h2>
            <p className="text-sm text-muted-foreground">Use seu e-mail corporativo e a senha de rede Nexo.</p>
          </div>
          <LoginForm />
        </div>
        <footer className="flex justify-between text-xs text-muted-foreground">
          <span>© Nexo · Tecnologia da Informação</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}

function ChatPreview() {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <p className="ml-auto w-fit rounded-xl rounded-tr-sm bg-white px-3 py-2 text-navy">Meu notebook não conecta na VPN. Erro 809.</p>
      <p className="text-xs text-navy-foreground/60">Nexo Assist · consultou a central · montou o chamado</p>
      <p className="w-fit rounded-xl rounded-tl-sm bg-white/10 px-3 py-2">Prioridade alta. Um analista responde até as 13h.</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-serif text-3xl">{value}</dt>
      <dd className="text-xs text-navy-foreground/60">{label}</dd>
    </div>
  );
}
