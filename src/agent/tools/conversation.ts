import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { HANDOFF_REASON_LABEL } from "@/domain/conversation";
import { turnFrom } from "../turn-context";
import { attempt } from "./shared";

export const offerQuickReplies = createTool({
  id: "offerQuickReplies",
  description:
    "Mostra botões de resposta rápida abaixo da sua pergunta (ex.: quem é afetado: Só eu / Minha equipe / Toda a empresa / Não sei). " +
    "Use quando a resposta esperada for uma escolha curta.",
  inputSchema: z.object({
    options: z.array(z.string().min(1).max(40)).min(2).max(4),
  }),
  execute: async ({ options }, context) => {
    const { recorder } = turnFrom(context);
    recorder.card({ kind: "quick_replies", options });
    // Prazo que atende a necessidade: o botão de analista sai já aqui (e de novo no fim do turno).
    recorder.finishAnalystOffer();
    return { ok: true };
  },
});

export const transferToAnalyst = createTool({
  id: "transferToAnalyst",
  description:
    "Transfere a conversa para um analista humano e pausa você. Use quando o funcionário pedir, quando um chamado estiver " +
    "vencido e ele aceitar ajuda, ou em caso crítico. O resumo deve permitir ao analista atender sem perguntar tudo de novo.",
  inputSchema: z.object({
    reason: z.enum(["employee_request", "critical", "overdue"]),
    summary: z.string().min(20).max(500).describe("Quem, qual problema, chamado relacionado, o que já foi feito e o que falta"),
    ticketCode: z.string().regex(/^(INC|REQ)-\d+$/i).optional(),
  }),
  execute: async ({ reason, summary, ticketCode }, context) => {
    const turn = turnFrom(context);
    const { conversations, tickets } = turn.services;

    return attempt(turn, "não conseguiu transferir", async () => {
      if (ticketCode) await tickets.markTransferred(turn.employee.id, ticketCode);
      await conversations.handoff(turn.conversationId, {
        reason,
        summary,
        ticketCode: ticketCode?.toUpperCase() ?? null,
        confidence: null,
      });
      turn.recorder.handedOff = true;
      turn.recorder.step("transferiu para um analista", HANDOFF_REASON_LABEL[reason]);
      return { ok: true, instruction: "Avise que um analista vai continuar por aqui e que você fica pausado até lá." };
    });
  },
});
