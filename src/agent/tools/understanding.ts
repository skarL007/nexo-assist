import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { LOW_CONFIDENCE, shouldHandOffForLowConfidence } from "@/domain/conversation";
import { INTENTS } from "@/domain/message";
import { turnFrom } from "../turn-context";

export { LOW_CONFIDENCE };

/**
 * Primeira chamada de todo turno (forçada no código, ver run-turn.ts).
 * É daqui que sai o "o que o agent entendeu, com que segurança e por quê".
 */
export const recordUnderstanding = createTool({
  id: "recordUnderstanding",
  description:
    "Registra o que você entendeu da última mensagem do funcionário, antes de agir. " +
    "confidence é sua segurança de 0 a 1 sobre a intenção E sobre qual ação tomar.",
  inputSchema: z.object({
    intent: z.enum(INTENTS).describe("Intenção principal da última mensagem"),
    understanding: z.string().max(300).describe("O que o funcionário quer, em uma frase, com os dados já conhecidos"),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().max(300).describe("Por que essa intenção e qual ação você vai tomar"),
  }),
  execute: async (input, context) => {
    const turn = turnFrom(context);
    turn.recorder.decision = input;

    const lowConfidence = input.confidence < LOW_CONFIDENCE && input.intent !== "greeting";
    if (!lowConfidence) return { ok: true };

    // Primeira dúvida: pergunta. Só transfere se a resposta anterior do agent também foi sem segurança.
    const recent = await turn.services.messages.listRecent(turn.conversationId, 10);
    const previous = recent.findLast((m) => m.role === "agent" && m.trace?.decision)?.trace?.decision ?? null;
    if (!shouldHandOffForLowConfidence(input, previous)) {
      turn.recorder.clarifying = true;
      turn.recorder.guardrail(
        `Confiança ${Math.round(input.confidence * 100)}% < ${LOW_CONFIDENCE * 100}%: primeiro uma pergunta de esclarecimento; se continuar sem segurança, um analista assume.`,
      );
      return {
        ok: true,
        instruction:
          "Sua segurança está baixa. Faça UMA pergunta curta para entender o que está acontecendo (qual sistema, o que aparece, desde quando). Não monte rascunho nem transfira ainda.",
      };
    }

    await turn.services.conversations.handoff(turn.conversationId, {
      reason: "low_confidence",
      summary: input.understanding,
      ticketCode: null,
      confidence: input.confidence,
    });
    turn.recorder.handedOff = true;
    turn.recorder.step("chamou um analista", `Confiança de ${Math.round(input.confidence * 100)}% — abaixo de ${LOW_CONFIDENCE * 100}%`);
    turn.recorder.guardrail(
      `Confiança ${Math.round(input.confidence * 100)}% < ${LOW_CONFIDENCE * 100}%: conversa transferida automaticamente pelo sistema.`,
    );
    return {
      handedOff: true,
      instruction: "Avise em uma frase que um analista vai continuar o atendimento por aqui. Não chame outras ferramentas.",
    };
  },
});
