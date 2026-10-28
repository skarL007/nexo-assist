import { describe, expect, it } from "vitest";
import { describeChanges, reviseNewTicket, urgencyOf, type NewTicketEdit } from "./draft-revision";
import type { NewTicketFields } from "./message";

const critical: NewTicketFields = {
  type: "INC",
  category: "hardware",
  title: "Monitores sem sinal",
  description: "Os monitores de vídeo não ligam desde hoje cedo, sem sinal.",
  impact: "company",
  urgency: "blocked",
  priority: "critical",
  priorityReason: "Impacto: toda a empresa · urgência: impede de trabalhar → Crítica",
};

const edit = (changes: Partial<NewTicketEdit> = {}): NewTicketEdit => ({
  type: critical.type,
  category: critical.category,
  title: critical.title,
  description: critical.description,
  impact: critical.impact,
  urgency: "blocked",
  ...changes,
});

describe("alterar detalhes do rascunho", () => {
  it("recalcula a prioridade pela matriz e diz o que mudou", () => {
    // Caso real: o agent entendeu "toda a empresa", mas o problema era só da funcionária.
    const { fields, changes } = reviseNewTicket(critical, edit({ impact: "me" }));
    expect(fields.priority).toBe("high");
    expect(fields.impact).toBe("me");
    expect(fields.priorityReason).toContain("→ Alta");
    expect(describeChanges(changes)).toBe("Afetados: Toda a empresa → Somente você · Prioridade: Crítica → Alta");
  });

  it("sem mudança, não há o que salvar", () => {
    expect(reviseNewTicket(critical, edit()).changes).toEqual([]);
  });

  it("título e descrição aparecem como atualizados, sem repetir a descrição inteira", () => {
    const { changes } = reviseNewTicket(critical, edit({ title: "Monitor da direita sem sinal", description: "Só o monitor da direita não liga." }));
    expect(describeChanges(changes)).toBe("Título: Monitor da direita sem sinal · Descrição atualizada");
  });

  it("tipo, categoria e urgência, com a prioridade que resulta deles", () => {
    const { fields, changes } = reviseNewTicket(critical, edit({ type: "REQ", category: "software", urgency: "none" }));
    expect(fields.priority).toBe("medium");
    expect(describeChanges(changes)).toBe(
      "Tipo: Incidente → Requisição · Categoria: Hardware → Software · Urgência: impede de trabalhar → sem urgência · Prioridade: Crítica → Média",
    );
  });

  it("guarda a urgência no rascunho, para a próxima edição", () => {
    expect(reviseNewTicket(critical, edit({ urgency: "has_workaround" })).fields.urgency).toBe("has_workaround");
  });

  it("rascunho antigo sem urgência: deduz uma coerente com a prioridade", () => {
    const legacy = { ...critical, urgency: undefined };
    expect(urgencyOf(legacy)).toBe("blocked");
    expect(urgencyOf({ ...legacy, impact: "me", priority: "medium" })).toBe("has_workaround");
    expect(urgencyOf({ ...legacy, impact: "me", priority: "low" })).toBe("none");
  });
});
