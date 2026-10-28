/**
 * Sonda da prova de fumaça da imagem Docker (chamada por scripts/docker-smoke.sh).
 * Roda DENTRO do contêiner (`docker exec -i ... node --input-type=module - <fase>`),
 * porque no CI o Docker é remoto e a porta do contêiner não chega ao localhost do job.
 * JavaScript puro de propósito: a imagem não tem tsx. Não chama o LLM.
 *
 * Fases:
 *   primeiro-start  login 200, rotas protegidas, analista assume a conversa da Carla (dado novo)
 *   depois-restart  a conversa da Carla continua assumida: o seed não rodou de novo
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const phase = process.argv[2];

function check(condition, message) {
  if (!condition) throw new Error(`falhou: ${message}`);
  console.log(`  ok  ${message}`);
}

/** Pedido com JSON e a mesma origem do app (a proteção CSRF exige isso nas mutações). */
async function call(path, { method = "GET", body, cookie } = {}) {
  const headers = { origin: BASE };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  return fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
}

/** Login pela rota real do app; devolve o cookie de sessão (marcado Secure, então é lido à mão). */
async function login(email) {
  const response = await call("/api/auth/login", { method: "POST", body: { email, password: "fumaca" } });
  check(response.status === 200, `POST /api/auth/login (${email}) responde 200 (veio ${response.status})`);
  const session = response.headers.getSetCookie().find((c) => c.startsWith("nexo_session="));
  check(Boolean(session), "login devolve o cookie nexo_session");
  return session.split(";")[0];
}

async function carla(analystCookie) {
  const response = await call("/api/console/conversations", { cookie: analystCookie });
  check(response.status === 200, `GET /api/console/conversations com sessão de analista responde 200 (veio ${response.status})`);
  const list = await response.json();
  check(Array.isArray(list) && list.length > 0, `o console lista conversas do seed (${list.length})`);
  return list.find((c) => c.id === "conv-carla");
}

if (phase === "primeiro-start") {
  const page = await call("/login");
  check(page.status === 200, `GET /login responde 200 (veio ${page.status})`);

  const anonymous = await call("/api/console/conversations");
  check(anonymous.status === 401, `sem sessão, a API do console responde 401 (veio ${anonymous.status})`);

  const employee = await login("carla.mendes@nexo.com.br");
  const chat = await call("/api/chat", { cookie: employee });
  check(chat.status === 200, `GET /api/chat com sessão de funcionária responde 200 (veio ${chat.status})`);
  const forbidden = await call("/api/console/conversations", { cookie: employee });
  check(forbidden.status === 403, `funcionária não acessa o console: 403 (veio ${forbidden.status})`);

  const analyst = await login("rafael.lima@nexo.com.br");
  const before = await carla(analyst);
  check(before?.status === "waiting_analyst", `conv-carla vem do seed aguardando analista (${before?.status})`);
  const assume = await call("/api/console/conversations/conv-carla", { method: "POST", body: { action: "assume" }, cookie: analyst });
  check(assume.status === 200, `analista assume conv-carla: 200 (veio ${assume.status})`);
  const after = await carla(analyst);
  check(after?.status === "with_analyst", `conv-carla agora está com o analista (${after?.status})`);
} else if (phase === "depois-restart") {
  const analyst = await login("rafael.lima@nexo.com.br");
  const kept = await carla(analyst);
  check(kept?.status === "with_analyst", `depois do restart, conv-carla continua com o analista (${kept?.status})`);
} else {
  throw new Error(`fase desconhecida: ${phase}`);
}
