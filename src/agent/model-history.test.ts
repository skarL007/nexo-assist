import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/domain/message";
import { stripSystemNotes, toModelMessages } from "./model-history";

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: "m1",
  conversationId: "c1",
  role: "agent",
  authorName: null,
  text: "",
  cards: [],
  trace: null,
  createdAt: "2026-10-27T12:00:00.000Z",
  ...overrides,
});

describe("toModelMessages", () => {
  it("resume os cards como nota do sistema entre ⟦ ⟧, separada do texto", () => {
    const [entry] = toModelMessages([
      message({ text: "Confira o rascunho.", cards: [{ kind: "quick_replies", options: ["Pode criar", "Cancelar"] }] }),
    ]);
    expect(entry).toEqual({
      role: "assistant",
      content: "Confira o rascunho. ⟦sistema: botões de resposta rápida exibidos: Pode criar / Cancelar⟧",
    });
  });

  it("limpa notas que o modelo copiou em respostas antigas", () => {
    const [entry] = toModelMessages([message({ text: "Posso abrir? [opções: Pode criar | Cancelar]" })]);
    expect(entry.content).toBe("Posso abrir?");
  });

  it("mensagem do funcionário vai como user, cortada no limite", () => {
    const [entry] = toModelMessages([message({ role: "employee", text: "a".repeat(2000) })]);
    expect(entry.role).toBe("user");
    expect(entry.content).toHaveLength(1500);
  });

  it("identifica o analista na mensagem dele", () => {
    const [entry] = toModelMessages([message({ role: "analyst", authorName: "Rafael Lima", text: "Já estou vendo." })]);
    expect(entry.content).toBe("[Analista Rafael Lima] Já estou vendo.");
  });
});

describe("stripSystemNotes", () => {
  it("remove notas do sistema que o modelo imitou na resposta", () => {
    expect(stripSystemNotes("Montei o rascunho.\n\n⟦sistema: rascunho D-1 exibido para confirmação⟧")).toBe("Montei o rascunho.");
  });

  it("remove o formato antigo de anotação", () => {
    expect(stripSystemNotes("Confira e me confirme. [opções: Pode criar | Alterar detalhes | Cancelar]")).toBe("Confira e me confirme.");
    expect(stripSystemNotes("Veja abaixo [card INC-20311: Notebook lento · open]")).toBe("Veja abaixo");
  });

  it("preserva colchetes que fazem parte da resposta", () => {
    expect(stripSystemNotes("Abra o menu [Configurações] e reinicie.")).toBe("Abra o menu [Configurações] e reinicie.");
  });
});
