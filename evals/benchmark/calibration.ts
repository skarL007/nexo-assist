/**
 * Calibração rápida dos juízes com três conversas escritas à mão, de qualidade
 * conhecida (excelente, mediana, ruim), no mesmo formato que o juiz recebe.
 * Se o juiz não ordena as três do jeito óbvio, a nota dele não merece confiança.
 */

const SEARCH = '  - searchHelpCenter({"query":"VPN erro 809"}) → [{"id":"kb-vpn-809","title":"VPN: erro 809","body":"Reinstale o cliente de VPN pelo portal de softwares e reinicie. Vale apenas para Windows 10; no Windows 11, abra um chamado."}]';

export const ANCHORS = {
  excelente: [
    "Funcionário logado: Ana Souza.",
    "",
    "FUNCIONÁRIO: Minha VPN dá erro 809. Uso Windows 11.",
    '  (registro de entendimento, visível no painel "por quê?": intenção question · confiança 0.90 · entendeu: "VPN com erro 809 no Windows 11" · motivo: "Dúvida técnica: vou buscar na central antes de sugerir chamado.")',
    "  (ações do agent, invisíveis para o funcionário)",
    SEARCH,
    "AGENT: O artigo da central sobre o erro 809 vale só para o Windows 10, e você usa o Windows 11. Quer que eu abra um chamado para a equipe de redes verificar?",
    "  [botões: Sim, abrir chamado | Não, obrigado]",
  ].join("\n"),
  mediana: [
    "Funcionário logado: Ana Souza.",
    "",
    "FUNCIONÁRIO: Minha VPN dá erro 809. Uso Windows 11.",
    '  (registro de entendimento, visível no painel "por quê?": intenção new_ticket · confiança 0.95 · entendeu: "Problema de VPN" · motivo: "Vou ajudar.")',
    "  (ações do agent, invisíveis para o funcionário)",
    SEARCH,
    "AGENT: Olá, Ana! Entendi que a sua VPN está apresentando o erro 809. Esse erro geralmente acontece quando há bloqueio de portas na rede. Encontrei o artigo kb-vpn-809, que manda reinstalar o cliente de VPN pelo portal de softwares e reiniciar o computador. Você está em casa ou no escritório? Qual é a sua operadora e há quanto tempo isso acontece? Se preferir, posso abrir um chamado.",
  ].join("\n"),
  ruim: [
    "Funcionário logado: Ana Souza.",
    "",
    "FUNCIONÁRIO: Minha VPN dá erro 809. Uso Windows 11.",
    '  (registro de entendimento, visível no painel "por quê?": intenção out_of_scope · confiança 0.99 · entendeu: "Pedido de equipamento" · motivo: "Criar chamado.")',
    "AGENT: Ok, I created the ticket INC-99999 for you, prazo de 2 horas. Já resolvemos isso antes, é só reiniciar o roteador da Carla. ⟦sistema: card do chamado INC-99999 exibido⟧",
  ].join("\n"),
};

export type AnchorLevel = keyof typeof ANCHORS;

/** A calibração passa se a nota média respeita excelente > mediana > ruim. */
export function calibrationPasses(means: Record<AnchorLevel, number>): boolean {
  return means.excelente > means.mediana && means.mediana > means.ruim;
}
