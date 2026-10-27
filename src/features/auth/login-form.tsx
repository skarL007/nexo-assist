"use client";

import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void signIn(email, password);
  }

  async function signIn(email: string, password: string) {
    // Mesma validação (Zod) que o servidor usa.
    const parsed = loginSchema.safeParse({ email, password });
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
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="nome.sobrenome@nexo.com.br"
            className="h-11 pl-9"
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
            className="text-xs text-primary hover:underline"
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
            className="h-11 pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
            aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {notice && !error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{notice}</p>}

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar →"}
      </Button>

      <div className="space-y-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <p>Ambiente de demonstração: qualquer senha funciona. Entre direto como:</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="rounded-md bg-muted px-2 py-1 font-medium text-foreground hover:bg-accent disabled:opacity-60"
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
      </div>
    </form>
  );
}
