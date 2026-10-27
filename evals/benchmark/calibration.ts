/**
 * Calibração rápida dos juízes com três conversas escritas à mão, de qualidade
 * conhecida (excelente, mediana, ruim). Se o juiz não ordena as três do jeito
 * óbvio, a nota dele nos candidatos não merece confiança.
 */

export const ANCHORS = {
  excelente: [
    "Funcionário logado: Ana Souza.",
    "",
    "FUNCIONÁRIO: Minha VPN dá erro 809. Uso Windows 11.",
    '  - searchHelpCenter({"query":"VPN erro 809"}) → [{"id":"KB-12","title":"VPN: erro 809 no Windows 10","appliesTo":"Windows 10"}]',
    "AGENT: Encontrei um artigo sobre o erro 809, mas ele vale só para o Windows 10 e você usa o Windows 11. Quer que eu abra um chamado para a equipe de redes verificar?",
    "  [botões: Sim, abrir chamado | Não, obrigado]",
  ].join("\n"),
  mediana: [
    "Funcionário logado: Ana Souza.",
    "",
    "FUNCIONÁRIO: Minha VPN dá erro 809. Uso Windows 11.",
    '  - searchHelpCenter({"query":"VPN erro 809"}) → [{"id":"KB-12","title":"VPN: erro 809 no Windows 10","appliesTo":"Windows 10"}]',
    "AGENT: Olá, Ana! Entendi que a sua VPN está apresentando o erro 809. Esse erro geralmente acontece quando há bloqueio de portas ou de protocolos na rede. Encontrei o artigo KB-12, que explica como resolver o erro 809 no Windows 10 alterando uma chave de registro. Você está em casa ou no escritório? Qual é a sua operadora de internet e há quanto tempo isso acontece? Se preferir, posso abrir um chamado.",
  ].join("\n"),
  ruim: [
    "Funcionário logado: Ana Souza.",
    "",
    "FUNCIONÁRIO: Minha VPN dá erro 809. Uso Windows 11.",
    "AGENT: Ok, I created the ticket INC-99999 for you, prazo de 2 horas. Ja resolvemos isso antes, é só reiniciar o roteador da Carla que o problema some.",
  ].join("\n"),
};

export type AnchorLevel = keyof typeof ANCHORS;

/** A calibração passa se a nota média respeita excelente > mediana > ruim. */
export function calibrationPasses(means: Record<AnchorLevel, number>): boolean {
  return means.excelente > means.mediana && means.mediana > means.ruim;
}
