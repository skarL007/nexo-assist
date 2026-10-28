import { describe, expect, it } from "vitest";
import { buildConversationReport, type ReportInput } from "./conversation-report";
import type { Card, ChatMessage, TicketSnapshot, TurnTrace } from "./message";

let seq = 0;
function msg(role: ChatMessage["role"], text: string, minute: number, extra: { cards?: Card[]; trace?: Partial<TurnTrace> } = {}): ChatMessage {
  return {
    id: `m${++seq}`,
    conversationId: "conv",
    role,
    authorName: role === "analyst" ? "Rafael Lima" : null,
    text,
    cards: extra.cards ?? [],
    trace: extra.trace ? { decision: null, steps: [], toolCalls: [], guardrails: [], model: "google/gemini", usage: null, latencyMs: 900, ...extra.trace } : null,
    createdAt: new Date(Date.UTC(2026, 9, 27, 13, minute)).toISOString(),
  };
}

const ticket = (code: string, extra: Partial<TicketSnapshot> = {}): TicketSnapshot => ({
  code,
  type: "INC",
  title: "Acesso ao SAP para fechamento",
  description: "Sem perfil de aprovação.",
  category: "access",
  priority: "high",
  status: "waiting_analyst",
  impact: "me",
  createdAt: "2026-10-27T10:00:00.000Z",
  updatedAt: "2026-10-27T10:00:00.000Z",
  deadline: "2026-10-27T14:00:00.000Z",
  overdue: false,
  ...extra,
});

const base: ReportInput = {
  employee: { name: "Carla Mendes", department: "Comercial" },
  status: "with_agent",
  handoff: null,
  messages: [],
  tickets: [],
  draftStatuses: {},
};

describe("relatório da conversa para o analista", () => {
  it("conversa transferida sem trace (como no seed): necessidade, motivo, chamado atual e quem espera", () => {
    const report = buildConversationReport({
      ...base,
      status: "waiting_analyst",
      handoff: { reason: "employee_request", summary: "Carla precisa de perfil de aprovação no SAP (INC-20320).", confidence: null, at: "2026-10-27T13:07:00.000Z" },
      messages: [
        msg("employee", "Preciso de acesso de aprovação no SAP ainda hoje.", 0),
        msg("agent", "Encontrei o seu INC-20320, prioridade alta.", 1),
        msg("employee", "Prefiro falar com alguém, é urgente.", 6),
        msg("system", "Transferido para o service desk", 7),
      ],
      tickets: [ticket("INC-20320", { status: "in_progress" }), ticket("REQ-10442", { title: "Segundo monitor" })],
    });

    expect(report.need).toBe("Carla precisa de perfil de aprovação no SAP (INC-20320).");
    expect(report.handoff?.reason).toBe("employee_request");
    expect(report.counts).toEqual({ employee: 2, agent: 1, analyst: 0 });
    expect(report.startedAt).toBe("2026-10-27T13:00:00.000Z");
    expect(report.lastAt).toBe("2026-10-27T13:07:00.000Z");
    // Só os chamados citados na conversa, com o status de agora (não o da mensagem).
    expect(report.tickets).toEqual([{ code: "INC-20320", ticket: expect.objectContaining({ status: "in_progress" }) }]);
    expect(report.pending).toEqual([{ kind: "waiting_analyst", since: "2026-10-27T13:07:00.000Z" }]);
  });

  it("junta o que o agent fez a partir dos traces: passos sem repetir, artigos, falhas e a menor confiança", () => {
    const report = buildConversationReport({
      ...base,
      messages: [
        msg("employee", "Minha VPN dá erro 809", 0),
        msg("agent", "Veja este artigo.", 1, {
          trace: {
            decision: { intent: "question", understanding: "VPN com erro 809 no Windows 11", confidence: 0.82, reasoning: "" },
            steps: [
              { label: "buscou na central de ajuda", ok: true },
              { label: "consultou seus chamados", ok: true },
            ],
            toolCalls: [{ tool: "searchHelpCenter", input: {}, output: { articles: [{ id: "kb-vpn", title: "VPN: erro 809", body: "…" }] }, durationMs: 4 }],
          },
        }),
        msg("employee", "Não resolveu", 2),
        msg("agent", "Vou ver seus chamados.", 3, {
          trace: {
            decision: { intent: "new_ticket", understanding: "VPN com erro 809 mesmo depois do artigo; quer abrir chamado", confidence: 0.45, reasoning: "" },
            steps: [
              { label: "buscou na central de ajuda", ok: true },
              { label: "sistema de chamados instável", detail: "Tentativa 1 falhou", ok: false },
            ],
            toolCalls: [{ tool: "searchHelpCenter", input: {}, output: { articles: [{ id: "kb-vpn", title: "VPN: erro 809", body: "…" }] }, durationMs: 3 }],
          },
        }),
      ],
    });

    expect(report.need).toBe("VPN com erro 809 mesmo depois do artigo; quer abrir chamado");
    expect(report.actions).toEqual(["buscou na central de ajuda", "consultou seus chamados"]);
    expect(report.failures).toEqual(["sistema de chamados instável"]);
    expect(report.articles).toEqual(["VPN: erro 809"]);
    expect(report.lowestConfidence).toBe(0.45);
    expect(report.pending).toEqual([]);
  });

  it("depois que o analista devolve a conversa, ainda mostra a última transferência (vem do card no histórico)", () => {
    // Achado na validação em produção: ao devolver, a conversa limpa a transferência e o relatório perdia o motivo.
    const report = buildConversationReport({
      ...base,
      status: "with_analyst",
      handoff: null,
      messages: [
        msg("employee", "Posso instalar um plugin no Figma?", 0),
        msg("system", "Transferido para o service desk", 2, { cards: [{ kind: "handoff", reason: "low_confidence", summary: "Bruno quer um plugin de IA no Figma." }] }),
        msg("system", "Rafael devolveu a conversa ao Nexo Assist", 30),
      ],
    });
    expect(report.need).toBe("Bruno quer um plugin de IA no Figma.");
    expect(report.handoff).toEqual({ reason: "low_confidence", summary: "Bruno quer um plugin de IA no Figma.", confidence: null, at: "2026-10-27T13:02:00.000Z" });
  });

  it("sem trace nem transferência, a necessidade é a primeira mensagem do funcionário", () => {
    const report = buildConversationReport({ ...base, messages: [msg("employee", "O Wi-Fi da sala 3 voltou a cair.", 0)] });
    expect(report.need).toBe("O Wi-Fi da sala 3 voltou a cair.");
  });

  it("aponta rascunho ainda sem confirmação (pelo status atual) e chamado citado com prazo vencido", () => {
    const draftCard = (id: number): Card => ({
      kind: "draft",
      draft: {
        id,
        kind: "create",
        status: "pending",
        deadline: "2026-10-27T17:00:00.000Z",
        fields: { type: "INC", title: `Impressora parada ${id}`, description: "…", category: "hardware", priority: "medium", impact: "me", priorityReason: "" },
      },
    });
    const report = buildConversationReport({
      ...base,
      messages: [
        msg("employee", "A impressora parou e o INC-20311 venceu", 0),
        msg("agent", "Montei o rascunho.", 1, { cards: [draftCard(7)] }),
        msg("agent", "Atualizei o rascunho.", 2, { cards: [draftCard(8)] }),
      ],
      draftStatuses: { 7: "replaced", 8: "pending" },
      tickets: [ticket("INC-20311", { title: "Notebook lento", overdue: true })],
    });

    expect(report.pending).toEqual([
      { kind: "draft", draftId: 8, title: "Impressora parada 8" },
      { kind: "overdue", code: "INC-20311", title: "Notebook lento", deadline: "2026-10-27T14:00:00.000Z" },
    ]);
  });

  it("se o sistema de chamados não respondeu, usa o retrato do chamado que apareceu na conversa", () => {
    const report = buildConversationReport({
      ...base,
      tickets: null,
      messages: [msg("agent", "Seu chamado:", 0, { cards: [{ kind: "ticket", ticket: ticket("INC-20320") }] })],
    });
    expect(report.tickets).toEqual([{ code: "INC-20320", ticket: expect.objectContaining({ title: "Acesso ao SAP para fechamento" }) }]);
  });
});
