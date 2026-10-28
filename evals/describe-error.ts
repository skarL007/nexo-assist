/**
 * Texto de um erro para o log dos evals: a mensagem inteira e a cadeia de `cause`
 * (nome, mensagem e código de cada nível). Cortar em N caracteres escondia o motivo
 * real, por exemplo um `Failed query: insert into "messages" ...` sem o SQLITE_BUSY por trás.
 */
const MAX_DEPTH = 6;

function describeOne(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const name = error.name === "Error" ? "" : `${error.name}: `;
    return `${name}${error.message}${code === undefined || code === null ? "" : ` [${String(code)}]`}`;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

export function describeError(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (parts.length < MAX_DEPTH && !seen.has(current)) {
    seen.add(current);
    parts.push(describeOne(current));
    if (!(current instanceof Error) || current.cause === undefined) break;
    current = current.cause;
  }
  return parts.join(" ← causa: ");
}
