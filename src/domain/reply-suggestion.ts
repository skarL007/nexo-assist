/**
 * Regras da sugestão de resposta para o analista (o texto vem do modelo; estas regras, não).
 */

const TICKET_CODE = /\b(?:INC|REQ)-\d+\b/g;

/** Números de chamado citados na sugestão que não aparecem no contexto dado ao modelo. */
export function unknownTicketCodes(suggestion: string, context: string): string[] {
  const known = new Set(context.match(TICKET_CODE) ?? []);
  return [...new Set(suggestion.match(TICKET_CODE) ?? [])].filter((code) => !known.has(code));
}

/** O que o analista fez com a sugestão ao enviar (mede se as sugestões servem). */
export const SUGGESTION_OUTCOMES = ["generated", "sent_as_is", "sent_edited"] as const;
export type SuggestionOutcome = (typeof SUGGESTION_OUTCOMES)[number];

/** Enviou igual (ignorando espaços nas pontas) ou editou? */
export const suggestionOutcome = (suggested: string, sent: string): SuggestionOutcome =>
  suggested.trim() === sent.trim() ? "sent_as_is" : "sent_edited";
