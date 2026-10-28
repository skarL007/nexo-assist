/** Checagens determinísticas de uma sugestão de resposta do analista. */
import { unknownTicketCodes } from "@/domain/reply-suggestion";

export interface SuggestionCase {
  name: string;
  conversationId: string;
  firstName: string;
  /** Pelo menos um destes termos (o assunto da conversa). */
  topic: string[];
}

/** Ações que ninguém fez: a sugestão não pode afirmar que o analista já resolveu algo. */
const INVENTED_ACTION = /\b(liberei|resolvi|já resolvi|foi resolvido|abri (um|o) (novo )?chamado|criei (um|o) chamado|reiniciei|desbloqueei)\b/i;

export function checkSuggestion(text: string, context: string, expected: SuggestionCase): string[] {
  const failures: string[] = [];
  const invented = unknownTicketCodes(text, context);
  if (invented.length) failures.push(`inventou ${invented.join(", ")}`);
  if (!text.includes(expected.firstName)) failures.push(`não chamou ${expected.firstName} pelo nome`);
  if (!expected.topic.some((t) => text.toLowerCase().includes(t.toLowerCase()))) failures.push(`fugiu do assunto (${expected.topic.join("/")})`);
  if (text.length > 600) failures.push(`longa demais (${text.length} caracteres)`);
  if (/\*\*|^#|^- /m.test(text)) failures.push("usou markdown");
  if (INVENTED_ACTION.test(text)) failures.push(`afirmou ação que ninguém fez ("${text.match(INVENTED_ACTION)?.[0]}")`);
  return failures;
}
