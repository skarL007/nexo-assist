/**
 * Simula o sistema de chamados legado: às vezes fica indisponível por um instante.
 * É um "decorator": embrulha o repositório real e, antes de cada chamada,
 * sorteia se esta vai falhar. A taxa vem de LEGACY_FAILURE_RATE.
 */
import type { TicketRepository } from "@/application/ports";
import { DomainError } from "@/domain/errors";

export class FlakyTicketRepository implements TicketRepository {
  constructor(
    private readonly inner: TicketRepository,
    private readonly failureRate: number,
    private readonly random: () => number = Math.random,
  ) {}

  private maybeFail() {
    if (this.random() < this.failureRate) {
      throw new DomainError("legacy_unavailable", "O sistema de chamados está indisponível no momento.");
    }
  }

  findByCode: TicketRepository["findByCode"] = async (code) => {
    this.maybeFail();
    return this.inner.findByCode(code);
  };

  listByOwner: TicketRepository["listByOwner"] = async (ownerId) => {
    this.maybeFail();
    return this.inner.listByOwner(ownerId);
  };

  nextCode: TicketRepository["nextCode"] = async (type) => {
    this.maybeFail();
    return this.inner.nextCode(type);
  };

  insert: TicketRepository["insert"] = async (ticket) => {
    this.maybeFail();
    return this.inner.insert(ticket);
  };

  update: TicketRepository["update"] = async (ticket) => {
    this.maybeFail();
    return this.inner.update(ticket);
  };

  addComment: TicketRepository["addComment"] = async (...args) => {
    this.maybeFail();
    return this.inner.addComment(...args);
  };
}
