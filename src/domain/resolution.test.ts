import { describe, expect, it } from "vitest";
import { classifyResolutions, summarizeResolutions, type ConversationFacts } from "./resolution";
import type { Card } from "./message";

const DAY = 86_400_000;
const t0 = Date.parse("2026-10-20T13:00:00.000Z");
let seq = 0;
const msg = (role: "employee" | "agent" | "analyst" | "system", text: string, day = 0, cards: Card[] = []) => ({
  id: `m${++seq}`,
  role,
  text,
  cards,
  trace: null,
  createdAt: new Date(t0 + day * DAY + seq * 1000).toISOString(),
});
const conv = (id: string, employeeId: string, messages: ConversationFacts["messages"], extra: Partial<ConversationFacts> = {}): ConversationFacts => ({
  id,
  employeeId,
  messages,
  feedback: [],
  drafts: [],
  ...extra,
});

const answer = msg("agent", "Siga o artigo: reinstale o certificado da VPN.");
const fixture: ConversationFacts[] = [
  // 1. disse "sim" no "Isso resolveu?"
  conv("sim", "ana", [msg("employee", "como configuro o e-mail no celular"), answer], { feedback: [{ messageId: answer.id, helpful: true }] }),
  // 2. silêncio depois do artigo
  conv("silencio", "bruno", [msg("employee", "qual o horário do service desk"), msg("agent", "Das 8h às 18h, de segunda a sexta.")]),
  // 3. terminou numa pergunta do agent
  conv("pergunta", "carla", [msg("employee", "meu sap travou"), msg("agent", "Qual transação aparece na tela?")]),
  // 4. transferida
  conv("transferida", "diego", [msg("employee", "quero falar com alguém"), msg("system", "Transferido", 0, [{ kind: "handoff", reason: "employee_request", summary: "…" }])]),
  // 5. resolvida, mas a pessoa voltou com o mesmo problema 3 dias depois → reaberta
  conv("reaberta", "elisa", [msg("employee", "o wifi da sala 3 caiu"), msg("agent", "Reinicie o roteador da sala 3.")]),
  conv("volta", "elisa", [msg("employee", "o wifi da sala 3 caiu de novo", 3), msg("agent", "Vou abrir um chamado.", 3)], { drafts: ["confirmed"] }),
  // 6. rascunho esperando o funcionário
  conv("rascunho", "fabio", [msg("employee", "teclado quebrado"), msg("agent", "Montei o rascunho do chamado.")], { drafts: ["pending"] }),
];

describe("resolução honesta (não deflexão)", () => {
  const outcomes = classifyResolutions(fixture);

  it("separa cada conversa pela regra publicada", () => {
    expect(Object.fromEntries(outcomes)).toEqual({
      sim: "confirmed",
      silencio: "presumed",
      pergunta: "abandoned",
      transferida: "human",
      reaberta: "reopened",
      volta: "ticket",
      rascunho: "in_progress",
    });
  });

  it("taxa = (confirmadas + presumidas) / conversas; custo por resolução = custo / resolvidas", () => {
    const summary = summarizeResolutions(outcomes, 0.7);
    expect(summary).toMatchObject({ confirmed: 1, presumed: 1, abandoned: 1, reopened: 1, human: 1, ticket: 1, inProgress: 1, notResolved: 0, resolved: 2, total: 7 });
    expect(summary.rate).toBeCloseTo(2 / 7);
    expect(summary.costPerResolutionUsd).toBeCloseTo(0.35);
  });

  it('"não" no "Isso resolveu?" é não resolvida, mesmo sem pergunta no fim', () => {
    const reply = msg("agent", "Tente reiniciar o notebook.");
    const outcome = classifyResolutions([conv("nao", "gil", [msg("employee", "notebook lento"), reply], { feedback: [{ messageId: reply.id, helpful: false }] })]);
    expect(outcome.get("nao")).toBe("not_resolved");
  });

  it("vale a última avaliação; respostas rápidas no fim contam como pergunta", () => {
    const first = msg("agent", "Veja o artigo A.");
    const second = msg("agent", "Veja o artigo B.");
    const asked = msg("agent", "Escolha uma opção", 0, [{ kind: "quick_replies", options: ["Sim", "Não"] }]);
    const outcomes = classifyResolutions([
      conv("mudou", "hel", [msg("employee", "impressora"), first, msg("employee", "não deu"), second], {
        feedback: [
          { messageId: first.id, helpful: false },
          { messageId: second.id, helpful: true },
        ],
      }),
      conv("botoes", "ivo", [msg("employee", "acesso"), asked]),
    ]);
    expect(outcomes.get("mudou")).toBe("confirmed");
    expect(outcomes.get("botoes")).toBe("abandoned");
  });

  it('quem agradece depois da resposta continua presumida; sem nenhuma resposta do agent é abandonada', () => {
    const outcomes = classifyResolutions([
      conv("obrigado", "kai", [msg("employee", "horário do service desk"), msg("agent", "Das 8h às 18h."), msg("employee", "Isso resolveu, obrigado!")]),
      conv("sem-resposta", "lia", [msg("employee", "alguém aí")]),
    ]);
    expect(outcomes.get("obrigado")).toBe("presumed");
    expect(outcomes.get("sem-resposta")).toBe("abandoned");
  });

  it("volta de outra pessoa, de outro assunto ou depois de 7 dias não reabre", () => {
    const outcomes = classifyResolutions([
      conv("a", "ana", [msg("employee", "vpn caiu"), msg("agent", "Reinstale o cliente.")]),
      conv("b", "bia", [msg("employee", "vpn caiu", 1), msg("agent", "Reinstale o cliente.", 1)]),
      conv("c", "ana", [msg("employee", "preciso de acesso ao figma", 2), msg("agent", "Pedido enviado.", 2)]),
      conv("d", "joao", [msg("employee", "outlook não abre"), msg("agent", "Feche e abra.")]),
      conv("e", "joao", [msg("employee", "outlook não abre", 9), msg("agent", "Feche e abra.", 9)]),
    ]);
    expect(outcomes.get("a")).toBe("presumed");
    expect(outcomes.get("d")).toBe("presumed");
  });

  it("sem conversas, taxa e custo por resolução são null", () => {
    expect(summarizeResolutions(new Map(), null)).toMatchObject({ total: 0, rate: null, costPerResolutionUsd: null });
  });
});
