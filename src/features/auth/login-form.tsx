"use client";

import { ArrowRight, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AboutPrototypeLink } from "@/components/nexo/about-prototype-link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/contracts/chat";
import { apiFetch } from "@/lib/api-client";

const DEMO_ACCOUNTS = [
  { email: "ana.souza@nexo.com.br", label: "Ana · funcionária" },
  { email: "rafael.lima@nexo.com.br", label: "Rafael · analista" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void signIn(email, password);
  }

  async function signIn(email: string, password: string) {
    // Mesma validação (Zod) que o servidor usa.
    const parsed = loginSchema.safeParse({ email, password, remember });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dados inválidos");

    setLoading(true);
    setError(null);
    try {
      const { redirectTo } = await apiFetch<{ redirectTo: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.replace(redirectTo);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail corporativo</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="nome.sobrenome@nexo.com.br"
            className="h-11 pl-10"
            aria-invalid={error ? true : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <button
            type="button"
            className="tap-target rounded text-[13px] font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2"
            onClick={() => {
              setError(null);
              setNotice("Na demonstração, qualquer senha funciona. Na Nexo, este link abriria a troca da senha de rede.");
            }}
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-11 pr-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="tap-target absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
            aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-muted-foreground select-none">
        <Checkbox className="after:-inset-4" checked={remember} onCheckedChange={(value) => setRemember(value === true)} />
        Manter conectado neste computador
      </label>

      {notice && !error && (
        <p role="status" className="reveal rounded-xl bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-muted-foreground">
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="reveal rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm leading-relaxed text-danger-foreground">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading} aria-busy={loading}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" /> <span className="sr-only">Entrando…</span>
          </>
        ) : (
          <>
            Entrar <ArrowRight aria-hidden="true" />
          </>
        )}
      </Button>

      <div className="space-y-3 rounded-2xl bg-background p-4 text-[13px] leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Ambiente de demonstração.</span> Qualquer senha funciona. Entre direto como:
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="tap-target h-9 rounded-full border bg-surface px-3.5 text-sm font-medium whitespace-nowrap text-foreground shadow-xs transition-[color,border-color,scale] duration-150 outline-none hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                setEmail(account.email);
                setPassword("demo");
                void signIn(account.email, "demo");
              }}
            >
              {account.label}
            </button>
          ))}
        </div>
        <p>
          <AboutPrototypeLink />
        </p>
      </div>
    </form>
  );
}
