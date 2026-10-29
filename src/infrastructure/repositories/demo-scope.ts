import { like, notLike, type AnyColumn } from "drizzle-orm";

/** Sem escopo, dados normais. Com escopo, somente o espaço do visitante autenticado. */
export const demoScopeWhere = (column: AnyColumn, scope?: string) =>
  scope ? like(column, `demo:${scope}:%`) : notLike(column, "demo:%");
