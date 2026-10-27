/** Aplica as migrações da pasta /drizzle no banco de DATABASE_URL. */
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "@/infrastructure/db/client";

async function main() {
  await migrate(createDatabase(), { migrationsFolder: "drizzle" });
  console.log("✔ migrações aplicadas");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
