/**
 * Sinal de frustração (como o sentimento do ServiceNow e do Zendesk), lido pelo
 * modelo no registro do entendimento. A decisão do que fazer com ele é código:
 * oferecer um analista, nunca transferir sozinho nem mexer na prioridade.
 */
export const FRUSTRATION_LEVELS = ["none", "some", "high"] as const;
export type Frustration = (typeof FRUSTRATION_LEVELS)[number];

export const FRUSTRATION_LABEL: Record<Exclude<Frustration, "none">, string> = {
  some: "Frustração moderada",
  high: "Frustração alta",
};

/** Texto do botão que a oferta põe na conversa (a pessoa decide clicar). */
export const OFFER_ANALYST_OPTION = "Falar com um analista";

export interface FrustrationSignal {
  level: Exclude<Frustration, "none">;
  reason: string | null;
}

/** Frustração registrada no último entendimento do agent (null se nenhuma). */
export function currentFrustration(
  messages: { role: string; trace: { decision: { frustration?: Frustration; frustrationReason?: string } | null } | null }[],
): FrustrationSignal | null {
  const decision = messages.findLast((m) => m.role === "agent" && m.trace?.decision)?.trace?.decision;
  if (!decision?.frustration || decision.frustration === "none") return null;
  return { level: decision.frustration, reason: decision.frustrationReason ?? null };
}

/** Alta, ou moderada em dois turnos seguidos. Traces antigos não têm o campo: contam como "none". */
export function shouldOfferAnalyst(current: { frustration?: Frustration }, previous: { frustration?: Frustration } | null): boolean {
  if (current.frustration === "high") return true;
  return current.frustration === "some" && (previous?.frustration === "some" || previous?.frustration === "high");
}
