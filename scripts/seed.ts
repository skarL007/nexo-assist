/**
 * Recria os dados de exemplo: apaga tudo e insere funcionários, artigos,
 * chamados e algumas conversas para o console do analista não começar vazio.
 * Os dados e a ordem das inserções ficam em src/infrastructure/db/seed.ts.
 */
import { createDatabase } from "@/infrastructure/db/client";
import { seedDemoData } from "@/infrastructure/db/seed";

async function main() {
  const totals = await seedDemoData(createDatabase());
  console.log(`✔ seed concluído (${totals.employees} pessoas, ${totals.articles} artigos, ${totals.tickets} chamados)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
