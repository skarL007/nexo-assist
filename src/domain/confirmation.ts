/**
 * Confirmação de rascunho por texto. O chamado só nasce pelo botão Confirmar ou por
 * uma mensagem que confirma sem ambiguidade: resposta a outra pergunta (inclusive o
 * clique numa resposta rápida), pergunta, hesitação ou pedido de mudança não contam.
 * Achado do funcionário simulado: "Tenho alternativa / Posso aguardar" virou "sim".
 */

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Qualquer um destes desfaz a confirmação: negação, espera, mudança, dúvida. */
const BLOCKERS = [
  /\?/,
  /\b(nao|nunca|nem)\b/,
  /\b(espera|espere|aguard\w*|depois|antes|ainda)\b/,
  /\b(mud\w*|alter\w*|troc\w*|corrig\w*|edit\w*|ajust\w*|errad\w*)\b/,
  /\b(cancel\w*|descart\w*|desist\w*)\b/,
  /\b(mas|porem|so que|entretanto)\b/,
];

/** Sinais de confirmação. "pode" sozinho só vale no começo ("pode", "pode sim", "pode criar"). */
const CONFIRMATIONS = [
  /^(sim|ok|okay|isso|exato|correto|perfeito|certo|beleza|fechado|positivo|confirmado)\b/,
  /^(isso mesmo|de acordo|tudo certo|(esta|ta) (certo|correto|tudo certo|otimo|bom))\b/,
  /^pode\b/,
  /\bpode (criar|abrir|confirmar|mandar|registrar|seguir|enviar|atualizar|prosseguir|reabrir)\b/,
  /\bconfirm(o|a|ar|ado|ada)\b/,
];

export function isExplicitConfirmation(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (BLOCKERS.some((pattern) => pattern.test(normalized))) return false;
  const words = normalized.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return CONFIRMATIONS.some((pattern) => pattern.test(words));
}
