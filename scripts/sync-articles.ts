/**
 * Atualiza a central de ajuda do banco de DATABASE_URL com os artigos do seed:
 * insere os novos e reescreve os existentes. Não apaga nada e não toca em
 * conversas, chamados ou contadores (por isso roda em todo deploy de produção).
 */
import { createDatabase } from "@/infrastructure/db/client";
import { syncArticles } from "@/infrastructure/db/seed";

async function main() {
  const total = await syncArticles(createDatabase());
  console.log(`✔ central de ajuda sincronizada (${total} artigos)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
