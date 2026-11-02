/**
 * Simula o sistema de chamados legado: às vezes fica indisponível por um instante.
 * É um "decorator": embrulha o repositório real e sorteia se cada chamada vai falhar.
 * A taxa vem de LEGACY_FAILURE_RATE. Com `afterWrite`, a escrita acontece e só a resposta
 * falha: é o caso que exige idempotência (tentar de novo não pode duplicar).
 */
import type { TicketRepository } from "@/application/ports";
import { DomainError } from "@/domain/errors";

export class FlakyTicketRepository implements TicketRepository {
  constructor(
    private readonly inner: TicketRepository,
    private readonly failureRate: number,
    private readonly random: () => number = Math.random,
    private readonly afterWrite = false,
  ) {}

  private maybeFail() {
    if (this.random() < this.failureRate) {
      throw new DomainError("legacy_unavailable", "O sistema de chamados está indisponível no momento.");
    }
  }

  /** Leitura falha antes de executar; escrita, com `afterWrite`, grava e só depois falha. */
  private async write(fn: () => Promise<void>): Promise<void> {
    if (!this.afterWrite) this.maybeFail();
    await fn();
    if (this.afterWrite) this.maybeFail();
  }

  findByCode: TicketRepository["findByCode"] = async (code) => {
    this.maybeFail();
    return this.inner.findByCode(code);
  };

  findByIdempotencyKey: TicketRepository["findByIdempotencyKey"] = async (key) => {
    this.maybeFail();
    return this.inner.findByIdempotencyKey(key);
  };

  listByOwner: TicketRepository["listByOwner"] = async (ownerId) => {
    this.maybeFail();
    return this.inner.listByOwner(ownerId);
  };

  listOpenCreatedSince: TicketRepository["listOpenCreatedSince"] = async (since) => {
    this.maybeFail();
    return this.inner.listOpenCreatedSince(since);
  };

  nextCode: TicketRepository["nextCode"] = async (type) => {
    this.maybeFail();
    return this.inner.nextCode(type);
  };

  insert: TicketRepository["insert"] = (...args) => this.write(() => this.inner.insert(...args));

  update: TicketRepository["update"] = (...args) => this.write(() => this.inner.update(...args));

  addComment: TicketRepository["addComment"] = (...args) => this.write(() => this.inner.addComment(...args));
}
