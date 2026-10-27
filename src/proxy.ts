/**
 * Proxy do Next 16 (antigo "middleware"): roda antes de toda página e rota.
 * Aplica a porta de acesso por token do deploy público (ver server/access-gate.ts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, ACCESS_PARAM, decideAccess } from "@/server/access-gate";

export function proxy(request: NextRequest) {
  const token = request.nextUrl.searchParams.get(ACCESS_PARAM);
  const now = new Date();
  const decision = decideAccess({
    secret: process.env.ACCESS_TOKEN || undefined,
    tokenFromUrl: token,
    tokenFromCookie: request.cookies.get(ACCESS_COOKIE)?.value,
    now,
  });

  switch (decision.kind) {
    case "open":
    case "allow":
      return NextResponse.next();

    case "grant": {
      // Grava o cookie com a validade do link e tira o token da URL (não fica no histórico nem em prints).
      const clean = request.nextUrl.clone();
      clean.searchParams.delete(ACCESS_PARAM);
      const response = NextResponse.redirect(clean);
      response.cookies.set(ACCESS_COOKIE, token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(1, Math.floor((decision.expiresAt.getTime() - now.getTime()) / 1000)),
      });
      return response;
    }

    case "deny":
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Acesso restrito. Use o link de acesso." }, { status: 401 });
      }
      return NextResponse.rewrite(new URL("/acesso", request.url), { status: 401 });
  }
}

export const config = {
  // Tudo, menos arquivos estáticos e a própria página de acesso restrito.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|acesso).*)"],
};
