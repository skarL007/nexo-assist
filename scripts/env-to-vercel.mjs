/**
 * Envia uma variável do .env local para a Vercel (Production) sem exibir o valor.
 *
 *   node scripts/env-to-vercel.mjs GOOGLE_GENERATIVE_AI_API_KEY
 *
 * O valor vai do arquivo direto para a entrada da CLI da Vercel: não aparece no
 * terminal, no histórico do shell nem em logs. Depois, é preciso um novo deploy.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2] ?? "";

// O nome entra num comando de shell: só letras maiúsculas, números e "_".
if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
  console.error("Uso: node scripts/env-to-vercel.mjs NOME_DA_VARIAVEL");
  process.exit(1);
}

const line = readFileSync(join(root, ".env"), "utf8")
  .split(/\r?\n/)
  .find((entry) => entry.startsWith(`${name}=`));
const value = line?.slice(name.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
if (!value) {
  console.error(`${name} não está definida no .env`);
  process.exit(1);
}

const vercel = (args, input) =>
  execSync(`npx vercel ${args}`, { cwd: root, input, stdio: [input === undefined ? "ignore" : "pipe", "ignore", "inherit"] });

try {
  vercel(`env rm ${name} production --yes`);
} catch {
  // ainda não existia na Vercel
}
vercel(`env add ${name} production --sensitive`, value);
console.log(`✔ ${name} enviada para a Vercel (Production) sem aparecer na tela.`);
