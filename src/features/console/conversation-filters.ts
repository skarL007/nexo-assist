/** Filtros e rótulos da lista do console — lógica pura, fácil de testar. */
import type { ConsoleConversationSummary } from "@/contracts/chat";
import type { Tone } from "@/components/nexo/status-pill";
import { formatRelative, percent } from "@/lib/format";

export const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "queue", label: "Para você" },
  { id: "agent", label: "Com o agent" },
  { id: "mine", label: "Minhas" },
] as const;
export type FilterId = (typeof FILTERS)[number]["id"];

export function matchesFilter(c: ConsoleConversationSummary, filter: FilterId, analystId: string): boolean {
  switch (filter) {
    case "all":
      return true;
    case "queue":
      return c.status === "waiting_analyst";
    case "agent":
      return c.status === "with_agent";
    case "mine":
      return c.status === "with_analyst" && c.analyst?.id === analystId;
  }
}

export function matchesSearch(c: ConsoleConversationSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.employee.name, c.ticketCode ?? "", c.lastMessage?.text ?? ""].some((field) => field.toLowerCase().includes(q));
}

/** Linha de estado de cada conversa: cor + texto. */
export function statusLine(c: ConsoleConversationSummary, analystId: string): { tone: Tone; text: string } {
  switch (c.status) {
    case "waiting_analyst":
      if (c.handoffReason === "low_confidence") {
        return { tone: "warning", text: `Agent pediu ajuda · confiança ${percent(c.handoffConfidence ?? 0)}` };
      }
      return { tone: "danger", text: c.handoffAt ? `Transferida ${formatRelative(c.handoffAt)}` : "Transferida" };
    case "with_analyst":
      return c.analyst?.id === analystId
        ? { tone: "info", text: "Você está atendendo" }
        : { tone: "info", text: `Com ${c.analyst?.name ?? "analista"}` };
    case "with_agent":
      return { tone: "success", text: "Agent atendendo" };
    case "closed":
      return { tone: "neutral", text: "Encerrada" };
  }
}

/** Fila primeiro (quem espera há mais tempo no topo), depois as demais por recência. */
export function sortForConsole(list: ConsoleConversationSummary[]): ConsoleConversationSummary[] {
  const rank = { waiting_analyst: 0, with_analyst: 1, with_agent: 2, closed: 3 } as const;
  return [...list].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    // Frustração alta primeiro entre as de mesmo status (nunca passa na frente de outro status).
    const calm = (c: ConsoleConversationSummary) => (c.frustration?.level === "high" ? 0 : 1);
    if (calm(a) !== calm(b)) return calm(a) - calm(b);
    if (a.status === "waiting_analyst") return (a.handoffAt ?? "").localeCompare(b.handoffAt ?? "");
    return (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? "");
  });
}
