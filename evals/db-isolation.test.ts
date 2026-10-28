import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Banco que cada runner de eval usa (a linha `process.env.DATABASE_URL = "file:...";`). */
function databaseOf(runner: string) {
  const source = readFileSync(new URL(runner, import.meta.url), "utf8");
  return /process\.env\.DATABASE_URL = "(file:[^"]+)"/.exec(source)?.[1];
}

/** Runners que recriam o banco antes de rodar (o benchmark tem um banco por candidato). */
const RUNNERS = {
  "npm run eval": { file: "./run.ts", database: "file:eval.db" },
  "npm run eval:sim": { file: "./sim/run.ts", database: "file:eval-sim.db" },
  "npm run eval:sugestao": { file: "./suggestion/run.ts", database: "file:eval-sugestao.db" },
};

describe("bancos dos evals", () => {
  it.each(Object.entries(RUNNERS))("`%s` usa o próprio banco", (_command, { file, database }) => {
    expect(databaseOf(file)).toBe(database);
  });

  it("nenhum runner compartilha arquivo de banco com outro", () => {
    const databases = Object.values(RUNNERS).map(({ file }) => databaseOf(file));
    expect(new Set(databases).size).toBe(databases.length);
  });

  it("o .gitignore cobre os arquivos de banco local (e os do modo WAL)", () => {
    const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8").split(/\r?\n/);
    expect(ignore).toEqual(expect.arrayContaining(["*.db", "*.db-wal", "*.db-shm"]));
  });
});
