/**
 * Confere se a demo pública está no ar e funcionando, sem chamar o modelo (não gasta o teto).
 * Entra como Ana (login de um clique da demo), lê a conversa pela API, que passa pelo banco,
 * e confere a página do estudo de caso. Guarda o cookie entre execuções para reaproveitar
 * o mesmo espaço de visitante em vez de criar um novo a cada vez.
 *
 * Uso: node scripts/checar-demo.mjs [url-da-demo]   → sai com código 1 se algo falhar.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = (process.argv[2] ?? "https://nexo-assist-puce.vercel.app").replace(/\/$/, "");
const cookieFile = join(tmpdir(), "nexo-checar-demo.cookie");
const results = [];

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, detail: error.message });
  }
}

async function get(url, cookie) {
  const response = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  return response;
}

async function login() {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ana.souza@nexo.com.br", password: "demo", remember: true }),
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 200) throw new Error(`login respondeu ${response.status}`);
  const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  writeFileSync(cookieFile, cookie);
  return cookie;
}

await step("página de login", async () => {
  const response = await get(`${base}/login`);
  if (response.status !== 200) throw new Error(`respondeu ${response.status}`);
  return "200";
});

await step("conversa da Ana pela API (banco)", async () => {
  let cookie = existsSync(cookieFile) ? readFileSync(cookieFile, "utf8") : await login();
  let response = await get(`${base}/api/chat`, cookie);
  if (response.status === 401 || response.status === 403) response = await get(`${base}/api/chat`, await login());
  if (response.status !== 200) throw new Error(`respondeu ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.messages)) throw new Error("resposta sem a lista de mensagens");
  return `${body.messages.length} mensagens, ${body.remainingMessages}/${body.messageLimit} restantes na sessão`;
});

await step("estudo de caso no portfólio", async () => {
  const response = await get("https://skarl007.github.io/nexo-assist/");
  if (response.status !== 200) throw new Error(`respondeu ${response.status}`);
  return "200";
});

for (const r of results) console.log(`${r.ok ? "OK  " : "FALHA"} ${r.name} (${r.ms} ms): ${r.detail}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
