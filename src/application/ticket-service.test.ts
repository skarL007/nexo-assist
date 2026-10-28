import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import type { Category } from "@/domain/ticket";
import { FlakyTicketRepository } from "@/infrastructure/legacy-ticket-system";
import { fixedClock, InMemoryTicketRepository, makeTicket } from "./test-doubles";
import { TicketService } from "./ticket-service";

const clock = fixedClock("2026-10-27T13:00:00Z");

function setup(tickets = [makeTicket()]) {
  const repo = new InMemoryTicketRepository(tickets);
  return { repo, service: new TicketService(repo, { clock, retryDelayMs: 0 }) };
}

describe("privacidade", () => {
  it("não entrega chamado de outro funcionário", async () => {
    const { service } = setup([makeTicket({ ownerId: "carlos" })]);
    await expect(service.getMine("ana", "INC-20311")).rejects.toMatchObject({ code: "not_found" });
  });

  it("lista só os chamados do próprio funcionário", async () => {
    const { service } = setup([makeTicket(), makeTicket({ code: "INC-1", ownerId: "carlos" })]);
    const mine = await service.listMine("ana");
    expect(mine.map((t) => t.code)).toEqual(["INC-20311"]);
  });
});

describe("duplicidade e reabertura", () => {
  const incident = (category: Category, title: string) => ({ type: "INC" as const, category, title });

  it("considera duplicado um aberto do mesmo tipo e categoria com palavra em comum no título", async () => {
    const { service } = setup();
    expect(await service.findPossibleDuplicates("ana", incident("hardware", "Notebook continua lento"))).toHaveLength(1);
    expect(await service.findPossibleDuplicates("ana", incident("network", "Notebook continua lento"))).toHaveLength(0);
  });

  it("não oferece chamado da mesma categoria que é outro problema", async () => {
    // Achado no teste em produção: "tela não liga" oferecia o pedido de segundo monitor.
    const { service } = setup([makeTicket({ code: "REQ-10442", type: "REQ", title: "Segundo monitor para home office" })]);
    expect(await service.findPossibleDuplicates("ana", incident("hardware", "Tela não está ligando"))).toHaveLength(0);
  });

  it("pedido (REQ) e incidente (INC) não são o mesmo problema, mesmo com palavra em comum", async () => {
    // "Monitor da direita não liga" (INC) não é o pedido "Segundo monitor para home office" (REQ).
    const { service } = setup([makeTicket({ code: "REQ-10442", type: "REQ", title: "Segundo monitor para home office" })]);
    expect(await service.findPossibleDuplicates("ana", incident("hardware", "Monitor da direita não liga"))).toHaveLength(0);
  });

  it("ignora acentos, maiúsculas e palavras genéricas na comparação", async () => {
    const { service } = setup([makeTicket({ title: "Erro na impressão do 3º andar" })]);
    expect(await service.findPossibleDuplicates("ana", incident("hardware", "IMPRESSAO falhando"))).toHaveLength(1);
    expect(await service.findPossibleDuplicates("ana", incident("hardware", "Erro no teclado"))).toHaveLength(0);
  });

  it("lista como reabríveis só os resolvidos há até 7 dias", async () => {
    const { service } = setup([
      makeTicket({ code: "INC-1", status: "resolved", resolvedAt: new Date("2026-10-23T13:00:00Z") }),
      makeTicket({ code: "INC-2", status: "resolved", resolvedAt: new Date("2026-10-10T13:00:00Z") }),
      makeTicket({ code: "INC-3", status: "open" }),
    ]);
    expect((await service.listReopenable("ana")).map((t) => t.code)).toEqual(["INC-1"]);
  });

  it("reabre um chamado resolvido há 4 dias", async () => {
    const resolvedAt = new Date("2026-10-23T13:00:00Z");
    const { service } = setup([makeTicket({ status: "resolved", resolvedAt })]);
    const ticket = await service.addComment("ana", "INC-20311", "Voltou a acontecer", true);
    expect(ticket.status).toBe("open");
  });

  it("não reabre chamado resolvido há mais de 7 dias", async () => {
    const resolvedAt = new Date("2026-10-10T13:00:00Z");
    const { service } = setup([makeTicket({ status: "resolved", resolvedAt })]);
    await expect(service.addComment("ana", "INC-20311", "Voltou", true)).rejects.toMatchObject({
      code: "reopen_window_expired",
    });
  });
});

describe("sistema legado instável", () => {
  it("tenta de novo e funciona quando a falha é passageira", async () => {
    const results = [0, 0.9]; // 1ª chamada falha (0 < 0.5), 2ª passa
    const flaky = new FlakyTicketRepository(new InMemoryTicketRepository([makeTicket()]), 0.5, () => results.shift() ?? 1);
    const retries: number[] = [];
    const service = new TicketService(flaky, { clock, retryDelayMs: 0, onRetry: (n) => retries.push(n) });

    await expect(service.getMine("ana", "INC-20311")).resolves.toMatchObject({ code: "INC-20311" });
    expect(retries).toEqual([1]);
  });

  it("desiste depois de 3 tentativas", async () => {
    const flaky = new FlakyTicketRepository(new InMemoryTicketRepository(), 1);
    const service = new TicketService(flaky, { clock, retryDelayMs: 0 });
    await expect(service.listMine("ana")).rejects.toBeInstanceOf(DomainError);
  });
});

describe("snapshot", () => {
  it("marca o chamado como vencido quando passou do prazo", async () => {
    const { service } = setup();
    const snapshot = service.snapshot(makeTicket({ updatedAt: new Date("2026-10-15T13:00:00Z") }));
    expect(snapshot.overdue).toBe(true);
  });
});

describe("incidente em massa", () => {
  const at = new Date("2026-10-27T12:00:00Z"); // 1 h antes do relógio fixo, dentro do expediente
  const vpn = (code: string, ownerId: string) => makeTicket({ code, ownerId, title: "VPN caiu", category: "network", status: "open", createdAt: at, updatedAt: at });

  it("conta só os relatos de outras pessoas: os próprios chamados da Ana não fazem dela um incidente", async () => {
    const { service } = setup([vpn("INC-1", "ana"), vpn("INC-2", "ana"), vpn("INC-3", "bia"), vpn("INC-4", "caio")]);
    expect(await service.knownIssueFor("ana", { category: "network", title: "VPN caiu agora", description: "…" })).toBeNull();
    // Para o console são 3 pessoas (ana, bia, caio): o banner aparece.
    expect(await service.knownIssues()).toHaveLength(1);
  });

  it("três outras pessoas com o mesmo problema: a Ana entra num incidente conhecido", async () => {
    const { service } = setup([vpn("INC-1", "bia"), vpn("INC-2", "caio"), vpn("INC-3", "duda")]);
    expect(await service.knownIssueFor("ana", { category: "network", title: "VPN caiu agora", description: "…" })).toMatchObject({ people: 3, reports: 3 });
    expect(await service.knownIssues()).toHaveLength(1);
  });
});
