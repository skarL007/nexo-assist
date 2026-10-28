import { describe, expect, it } from "vitest";
import { chatReducer, sendMessage } from "./chat-slice";

const sending = chatReducer(undefined, sendMessage.pending("req", "Minha VPN dá erro 809"));

describe("falha ao enviar não apaga o que o funcionário escreveu", () => {
  // Achado da auditoria: a mensagem sumia do campo e só sobrava o aviso.
  it("erro antes de a mensagem ser gravada devolve o texto para o campo", () => {
    const state = chatReducer(sending, { type: "chat/streamEvent", payload: { type: "error", message: "O Nexo Assist não está configurado" } });
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
