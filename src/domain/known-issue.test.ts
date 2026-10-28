import { describe, expect, it } from "vitest";
import { detectKnownIssues, knownIssueFor } from "./known-issue";
import type { Ticket } from "./ticket";

// Terça, 28/10/2026, 14h em Brasília (17h UTC): dentro do expediente.
const now = new Date("2026-10-28T17:00:00.000Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
let seq = 0;
const ticket = (ownerId: string, title: string, createdAt: Date, extra: Partial<Ticket> = {}): Ticket => ({
  code: `INC-${++seq}`,
  type: "INC",
  title,
  description: "…",
  category: "network",
  priority: "medium",
  status: "open",
  impact: "me",
  ownerId,
  createdAt,
  updatedAt: createdAt,
  resolvedAt: null,
  ...extra,
});

describe("incidente em massa", () => {
  const vpn = [
    ticket("bia", "VPN caiu", hoursAgo(1)),
    ticket("caio", "VPN não conecta", hoursAgo(2)),
    ticket("duda", "Sem VPN desde cedo", hoursAgo(3)),
    ticket("duda", "VPN de novo", hoursAgo(0.5)),
  ];

  it("3 pessoas diferentes, mesma categoria e termo, nas últimas 4 h úteis → um incidente conhecido", () => {
    expect(detectKnownIssues(vpn, now)).toEqual([{ category: "network", terms: ["vpn"], reports: 4, people: 3, since: hoursAgo(3) }]);
  });

  it("só 2 pessoas, ou relatos fora da janela, não formam incidente", () => {
    expect(detectKnownIssues(vpn.slice(0, 2), now)).toEqual([]);
    expect(detectKnownIssues([...vpn.slice(0, 2), ticket("eva", "VPN fora", hoursAgo(30))], now)).toEqual([]);
  });

  it("a janela é em horas úteis: um relato das 17h de ontem ainda conta às 9h de hoje", () => {
    const morning = new Date("2026-10-29T12:00:00.000Z"); // quarta, 9h em Brasília
    const lateYesterday = new Date("2026-10-28T20:00:00.000Z"); // terça, 17h
    const issues = detectKnownIssues([ticket("a", "VPN caiu", lateYesterday), ticket("b", "VPN caiu", morning), ticket("c", "VPN caiu", morning)], morning);
    expect(issues).toHaveLength(1);
  });

  it("chamado resolvido, pedido (REQ) e categoria diferente não entram", () => {
    const mixed = [
      ticket("a", "VPN caiu", hoursAgo(1)),
      ticket("b", "VPN caiu", hoursAgo(1), { status: "resolved", resolvedAt: hoursAgo(0.5) }),
      ticket("c", "VPN caiu", hoursAgo(1), { type: "REQ" }),
      ticket("d", "VPN caiu", hoursAgo(1), { category: "software" }),
    ];
    expect(detectKnownIssues(mixed, now)).toEqual([]);
  });

  it("o rascunho de quem relata o mesmo problema encontra o incidente; outro assunto não", () => {
    const issues = detectKnownIssues(vpn, now);
    expect(knownIssueFor({ category: "network", title: "VPN caiu agora", description: "não conecta" }, issues)?.reports).toBe(4);
    expect(knownIssueFor({ category: "network", title: "Wi-Fi da sala 3", description: "caiu" }, issues)).toBeNull();
    expect(knownIssueFor({ category: "software", title: "VPN no app", description: "…" }, issues)).toBeNull();
  });

  it("a saída não leva quem relatou nem os números dos chamados", () => {
    const text = JSON.stringify(detectKnownIssues(vpn, now));
    for (const secret of ["bia", "caio", "duda", "INC-"]) expect(text).not.toContain(secret);
  });
});
