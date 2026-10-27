/**
 * Envia uma variável do .env local para a Vercel (Production) sem exibir o valor.
 *
 *   node scripts/env-to-vercel.mjs GOOGLE_GENERATIVE_AI_API_KEY
 *   node scripts/env-to-vercel.mjs NOME --env-file outro-arquivo.env
 *
 * O valor vai do arquivo direto para a entrada da CLI da Vercel: não aparece no
 * terminal, no histórico do shell nem em logs. Depois, é preciso um novo deploy.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [name = "", flag, file] = process.argv.slice(2);
const envFile = flag === "--env-file" && file ? resolve(file) : join(root, ".env");

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

// O nome entra num comando de shell: só letras maiúsculas, números e "_".
if (!/^[A-Z][A-Z0-9_]*$/.test(name)) fail("Uso: node scripts/env-to-vercel.mjs NOME_DA_VARIAVEL [--env-file arquivo]");

const line = readFileSync(envFile, "utf8")
  .split(/\r?\n/)
  .find((entry) => entry.startsWith(`${name}=`));
const value = line?.slice(name.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
if (!value) fail(`${name} não está definida em ${envFile}`);

// --force sobrescreve se já existir; a saída da CLI é conferida (ela não contém o valor).
let output;
try {
  output = execSync(`npx vercel env add ${name} --environment production --sensitive --force`, {
    cwd: root,
    input: value,
    stdio: ["pipe", "pipe", "pipe"],
  }).toString();
} catch (error) {
  fail(`a CLI da Vercel recusou: ${String(error.stdout ?? "")}${String(error.stderr ?? "")}`.trim());
}
if (/"status":\s*"(error|action_required)"/.test(output)) fail(`a CLI da Vercel recusou: ${output.trim()}`);

// Impressão digital curta (8 caracteres do SHA-256) para conferir que o valor certo chegou, sem revelá-lo.
const fingerprint = createHash("sha256").update(value).digest("hex").slice(0, 8);
console.log(`✔ ${name} enviada para a Vercel (Production) sem aparecer na tela · ${value.length} caracteres · sha256 ${fingerprint}…`);
