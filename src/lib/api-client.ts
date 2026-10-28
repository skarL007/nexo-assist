export const NETWORK_ERROR = "Sem conexão com o servidor. Verifique a rede e tente de novo.";

/** fetch que, sem conexão, falha com uma mensagem em português (o navegador diz "Failed to fetch"). */
export function fetchOrOffline(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(NETWORK_ERROR);
  });
}

/** fetch com JSON e mensagem de erro legível vinda da API. */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchOrOffline(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Lê um corpo NDJSON (um JSON por linha) conforme os pedaços chegam. */
export async function* readNdjson<T>(response: Response): AsyncGenerator<T> {
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as T;
}

/** Mensagem de um erro de qualquer formato (o unwrap do Redux rejeita com um objeto simples, não com Error). */
export function messageOf(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}
