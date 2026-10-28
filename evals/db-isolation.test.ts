import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Banco que cada runner de eval usa (a linha `process.env.DATABASE_URL = "file:...";`). */
function databaseOf(runner: string) {
  const source = readFileSync(new URL(runner, import.meta.url), "utf8");
  return /process\.env\.DATABASE_URL = "(file:[^"]+)"/.exec(source)?.[1];
}

describe("bancos dos evals", () => {
  it("`npm run eval` e `npm run eval:sim` não compartilham arquivo de banco", () => {
    const eval_ = databaseOf("./run.ts");
    const sim = databaseOf("./sim/run.ts");
    expect(eval_).toBe("file:eval.db");
    expect(sim).toBe("file:eval-sim.db");
  });

  it("o .gitignore cobre os arquivos de banco local", () => {
    const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8").split(/\r?\n/);
    expect(ignore).toContain("*.db");
  });
});
