import { describe, expect, it } from "vitest";
import { chatReducer, rateReply, sendMessage } from "./chat-slice";

const sending = chatReducer(undefined, sendMessage.pending("req", "Minha VPN dá erro 809"));

describe("falha ao enviar não apaga o que o funcionário escreveu", () => {
  // Achado da auditoria: a mensagem sumia do campo e só sobrava o aviso.
  it("erro antes de a mensagem ser gravada devolve o texto para o campo", () => {
    const state = chatReducer(sending, { type: "chat/streamEvent", payload: { type: "error", message: "O Farol Desk não está configurado" } });
    expect(state.unsentText).toBe("Minha VPN dá erro 809");
    expect(state.optimisticText).toBeNull();
    expect(state.error).toContain("não está configurado");
  });

  it("falha de rede também devolve o texto", () => {
    const state = chatReducer(sending, sendMessage.rejected(new Error("Sem conexão com o servidor."), "req", "Minha VPN dá erro 809"));
    expect(state.unsentText).toBe("Minha VPN dá erro 809");
    expect(state.error).toBe("Sem conexão com o servidor.");
  });
});

describe("envio com imagem anexada", () => {
  const image = { mime: "image/jpeg", data: "AAAA", previewUrl: "blob:monitor" };
  const withImage = chatReducer(undefined, sendMessage.pending("req", { text: "o monitor não liga", image }));

  it("mostra o texto e a miniatura antes de o servidor confirmar", () => {
    expect(withImage.optimisticText).toBe("o monitor não liga");
    expect(withImage.optimisticImage).toBe("blob:monitor");
  });

  it("só a imagem: o texto otimista é o mesmo que o servidor grava", () => {
    const state = chatReducer(undefined, sendMessage.pending("req", { text: "", image }));
    expect(state.optimisticText).toBe("Enviei uma imagem.");
  });

  it("falha devolve o texto e a imagem ao campo", () => {
    const state = chatReducer(withImage, sendMessage.rejected(new Error("A imagem passou de 1 MB."), "req", { text: "o monitor não liga", image }));
    expect(state.unsentText).toBe("o monitor não liga");
    expect(state.unsentImage).toEqual(image);
    expect(state.optimisticImage).toBeNull();
  });
});

describe('"Isso resolveu?"', () => {
  const loaded = chatReducer(undefined, {
    type: "chat/load/fulfilled",
    payload: { id: "c1", status: "with_agent", analystName: null, remainingMessages: 30, messageLimit: 30, draftStatuses: {}, feedback: {}, messages: [] },
  });
  const arg = { messageId: "m1", helpful: false };

  it("marca na hora, sem esperar o servidor", () => {
    expect(chatReducer(loaded, rateReply.pending("req", arg)).conversation?.feedback).toEqual({ m1: false });
  });

  it("se o servidor recusar, desfaz a marcação e avisa", () => {
    const pending = chatReducer(loaded, rateReply.pending("req", arg));
    const state = chatReducer(pending, rateReply.rejected(new Error("Resposta não encontrada."), "req", arg));
    expect(state.conversation?.feedback).toEqual({});
    expect(state.error).toBe("Resposta não encontrada.");
  });
});
