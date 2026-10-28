import { describe, expect, it } from "vitest";
import { describeError } from "./describe-error";

describe("describeError (o log do eval não pode cortar a causa)", () => {
  it("erro simples: a mensagem inteira, sem cortar", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    const long = `Failed query: insert into "messages" (${"x".repeat(500)})`;
    expect(describeError(new Error(long))).toBe(long);
  });

  it("segue a cadeia de `cause` com nome e código", () => {
    const sqlite = Object.assign(new Error("database is locked"), { name: "LibsqlError", code: "SQLITE_BUSY" });
    const failed = new Error('Failed query: insert into "messages" ("id", "conversation_id", "role", "author_name", "text")', { cause: sqlite });
    const text = describeError(failed);
    expect(text).toContain('Failed query: insert into "messages" ("id", "conversation_id", "role", "author_name", "text")');
    expect(text).toContain("causa: LibsqlError: database is locked [SQLITE_BUSY]");
  });

  it("encadeia mais de um nível e aceita causa que não é Error", () => {
    const root = new Error("raiz", { cause: "texto solto" });
    const middle = new Error("meio", { cause: root });
    const text = describeError(new Error("topo", { cause: middle }));
    expect(text).toBe("topo ← causa: meio ← causa: raiz ← causa: texto solto");
  });

  it("não entra em laço quando a causa aponta para o próprio erro", () => {
    const loop = new Error("volta");
    loop.cause = loop;
    expect(describeError(loop)).toBe("volta");
  });

  it("valor que não é Error: texto ou JSON", () => {
    expect(describeError("falhou")).toBe("falhou");
    expect(describeError({ code: 42 })).toBe('{"code":42}');
    expect(describeError(undefined)).toBe("undefined");
  });
});
