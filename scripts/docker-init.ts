/**
 * Roda antes do servidor na imagem Docker: migra o banco de DATABASE_URL e cria
 * os dados de exemplo só se ele estiver vazio (SEED_IF_EMPTY=0 desliga o seed).
 * A imagem não tem tsx: o Dockerfile empacota este arquivo com o esbuild
 * (`npm run build:docker-init`), deixando o driver do libSQL de fora do pacote.
 */
import { createDatabase } from "@/infrastructure/db/client";
import { prepareDatabase } from "@/infrastructure/db/bootstrap";

async function main() {
  const seedIfEmpty = process.env.SEED_IF_EMPTY !== "0";
  const { seeded } = await prepareDatabase(createDatabase(), {
    migrationsFolder: process.env.MIGRATIONS_FOLDER ?? "drizzle",
    seedIfEmpty,
  });
  console.log("✔ migrações aplicadas");
  if (seeded) console.log("✔ seed concluído (banco vazio)");
  else console.log(seedIfEmpty ? "✔ seed ignorado (o banco já tem dados)" : "✔ seed desligado (SEED_IF_EMPTY=0)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
