import { redirect } from "next/navigation";
import { env } from "@/config/env";
import { Brand } from "@/components/nexo/brand";
import { Button } from "@/components/ui/button";
import type { InsightsReport } from "@/domain/insights";
import { LoginForm } from "@/features/auth/login-form";
import { createServices } from "@/infrastructure/container";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatSeconds, percent } from "@/lib/format";
import { logError } from "@/server/http";
import { demoLoginEnabled } from "@/server/auth-mode";
import { currentUser, homeFor } from "@/server/session";
import { ssoConfig } from "@/server/sso";

const SSO_ERRORS: Record<string, string> = {
  desconhecido: "Seu e-mail não está no service desk. Fale com a TI no ramal 4000.",
  dominio: "Use a sua conta corporativa da Nexo.",
  falhou: "Não foi possível entrar pelo SSO. Tente de novo ou ligue no ramal 4000.",
};

export const dynamic = "force-dynamic";

/** Números de verdade deste ambiente (antes eram os do protótipo, fixos). Se o banco falhar, o login abre mesmo assim. */
async function loginStats(): Promise<InsightsReport | null> {
  try {
    return await createServices().insights.lastDays(30);
  } catch (error) {
    logError(error);
    return null;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));
  const stats = await loginStats();
  const sso = ssoConfig();
  const demoLogin = demoLoginEnabled(env());
  const ssoError = SSO_ERRORS[(await searchParams).sso ?? ""];

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between gap-10 overflow-hidden border-r bg-ink p-10 text-ink-foreground lg:flex xl:p-14">

        <div className="relative">
          <Brand inverted />
        </div>

        <div className="relative max-w-md space-y-6">
          <p className="text-sm font-medium text-muted-foreground">Service desk de TI da Nexo</p>
          <h1 className="font-serif text-[44px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance xl:text-[56px]">Seu problema de TI, resolvido em uma conversa.</h1>
          <p className="text-[17px] leading-relaxed text-muted-foreground xl:text-lg">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista
            quando precisa — e mostra o porquê de cada decisão.
          </p>
          <ChatPreview />
        </div>

        <div className="relative space-y-3 border-t border-border pt-6">
          <dl className="grid grid-cols-3 gap-8">
            <Stat value={stats?.avgLatencyMs != null ? formatSeconds(stats.avgLatencyMs) : "—"} label="resposta do agent, em média" />
            <Stat value={stats?.resolvedWithoutHuman != null ? percent(stats.resolvedWithoutHuman) : "—"} label="resolvido sem analista" />
            <Stat value={stats ? String(stats.analysts) : "—"} label="analistas no service desk" />
          </dl>
          <p className="text-xs text-muted-foreground">Números deste ambiente nos últimos 30 dias.</p>
        </div>
      </section>

      <section className="flex flex-col bg-surface px-5 py-6 sm:p-12">
        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="lg:hidden">
            <Brand />
          </div>
          <p className="text-right text-[13px] leading-snug text-muted-foreground sm:text-sm">
            Problema para entrar? <span className="font-medium whitespace-nowrap text-foreground">Ligue no ramal 4000</span>
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 py-10">
          <div className="space-y-2">
            <h2 className="font-serif text-[34px] leading-tight font-semibold tracking-[-0.02em]">Entrar</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {demoLogin ? "Use seu e-mail corporativo e a senha de rede Nexo." : `Entre com a sua conta corporativa (${sso?.label ?? "SSO"}).`}
            </p>
          </div>
          {ssoError && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm leading-relaxed text-danger-foreground">
              {ssoError}
            </p>
          )}
          {sso && (
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href="/api/auth/sso">Entrar com {sso.label}</a>
            </Button>
          )}
          {sso && demoLogin && (
            <p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              ou com e-mail e senha
            </p>
          )}
          {demoLogin && <LoginForm />}
        </div>
        <footer className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span>© Nexo · Tecnologia da Informação</span>
          <span>Protótipo · todos os dados são fictícios</span>
        </footer>
      </section>
    </main>
  );
}

function ChatPreview() {
  return (
    <div className="space-y-2.5 rounded-3xl bg-surface p-5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)]">
      <p className="ml-auto w-fit rounded-[18px] rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">Meu notebook não conecta na VPN. Erro 809.</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="size-1.5 shrink-0 rounded-full bg-beam" />
        <span className="font-medium text-foreground">{PRODUCT_NAME}</span>
        <span>consultou a central · montou o chamado</span>
        <span className="rounded-full bg-beam-soft px-2 py-px font-medium whitespace-nowrap text-beam-foreground">por quê?</span>
      </p>
      <p className="w-fit rounded-[18px] rounded-bl-md bg-muted px-3.5 py-2">Prioridade alta. Um analista responde até as 13h.</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-serif text-[32px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</dt>
      <dd className="mt-2 text-xs leading-snug text-muted-foreground">{label}</dd>
    </div>
  );
}
