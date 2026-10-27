/**
 * Gera um link de acesso temporário ao deploy.
 *   npm run access-link          → vale 5 minutos
 *   npm run access-link -- 60    → vale 60 minutos
 * Assina com o segredo ACCESS_TOKEN de .env.deploy.local (o mesmo da Vercel) e nunca o imprime.
 */
import { ACCESS_PARAM, createAccessToken } from "@/server/access-gate";

const DEPLOY_URL = process.env.DEPLOY_URL ?? "https://nexo-assist-puce.vercel.app";
const MAX_MINUTES = 30 * 24 * 60;

const secret = process.env.ACCESS_TOKEN;
if (!secret) {
  console.error("ACCESS_TOKEN não encontrado. Ele fica em .env.deploy.local (o mesmo valor configurado na Vercel).");
  process.exit(1);
}

const minutes = Number(process.argv[2] ?? 5);
if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
  console.error(`Informe a validade em minutos, de 1 a ${MAX_MINUTES}. Ex.: npm run access-link -- 60`);
  process.exit(1);
}

const expiresAt = new Date(Date.now() + minutes * 60_000);
const url = new URL(DEPLOY_URL);
url.searchParams.set(ACCESS_PARAM, createAccessToken(secret, expiresAt));

const until = expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
console.log(`Link de acesso, válido por ${minutes} min (até ${until}):\n${url}`);
