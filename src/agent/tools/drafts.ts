import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { classifyPriority, SLA_LABEL, URGENCIES } from "@/domain/priority";
import { CATEGORIES, IMPACTS, TICKET_TYPES } from "@/domain/ticket";
import { turnFrom } from "../turn-context";
import { attempt, formatDateTime } from "./shared";

export const draftNewTicket = createTool({
  id: "draftNewTicket",
  description:
    "Monta o RASCUNHO de um chamado novo para o funcionário conferir. Não cria o chamado. " +
    "Só chame quando souber o problema, quem é afetado (impact) e a urgência. " +
    "A prioridade é calculada pelo sistema a partir de impact × urgency. " +
    "Se houver chamado parecido aberto, a tool devolve os possíveis duplicados em vez do rascunho.",
  inputSchema: z.object({
    type: z.enum(TICKET_TYPES).describe("INC = algo parou ou não funciona; REQ = pedido de acesso, equipamento ou software"),
    category: z.enum(CATEGORIES),
    title: z.string().min(5).max(80).describe("Título curto e específico"),
    description: z
      .string()
      .min(20)
      .max(600)
      .describe("Descrição completa para o analista não precisar perguntar de novo: o que, desde quando, ambiente, o que já tentou"),
    impact: z.enum(IMPACTS).describe("me = só o funcionário; team = a equipe dele; company = a empresa"),
    urgency: z.enum(URGENCIES).describe("blocked = não consegue trabalhar; deadline_today = compromisso hoje; has_workaround = há alternativa; none = sem urgência"),
    ignoreDuplicates: z.boolean().default(false).describe("true só depois que o funcionário disse que não é nenhum dos chamados parecidos"),
  }),
  execute: async (input, context) => {
    const turn = turnFrom(context);
    const { tickets, drafts } = turn.services;

    return attempt(turn, "não conseguiu montar o rascunho", async () => {
      if (!input.ignoreDuplicates) {
        const duplicates = await tickets.findPossibleDuplicates(turn.employee.id, input.category, input.title);
        if (duplicates.length > 0) {
          const snapshots = duplicates.map((t) => tickets.snapshot(t));
          turn.recorder.step("verificou duplicidade", `${snapshots.length} chamado(s) parecido(s) (mesma categoria e título): ${snapshots.map((t) => t.code).join(", ")}`);
          turn.recorder.card({ kind: "ticket_choice", tickets: snapshots });
          return {
            possibleDuplicates: snapshots.map((t) => ({ code: t.code, title: t.title, status: t.status })),
            instruction:
              "Pergunte se o problema é um destes. Se for, use draftTicketUpdate nele. Se não for, chame draftNewTicket de novo com ignoreDuplicates=true.",
          };
        }
      }
      turn.recorder.step("verificou duplicidade", "Nenhum chamado parecido aberto");

      const { priority, reason } = classifyPriority(input.impact, input.urgency);
      turn.recorder.step("classificou a prioridade", reason);

      const draft = await drafts.proposeNewTicket(turn.conversationId, turn.employee.id, {
        type: input.type,
        category: input.category,
        title: input.title,
        description: input.description,
        impact: input.impact,
        priority,
        priorityReason: reason,
      });
      if (draft.kind !== "create") throw new Error("rascunho inesperado");

      turn.recorder.step("consultou o SLA", `${SLA_LABEL[priority]} → resposta até ${formatDateTime(draft.deadline)}`);
      turn.recorder.step("montou o rascunho", `D-${draft.id}`);
      turn.recorder.card({ kind: "draft", draft });

      return {
        draftId: draft.id,
        priority,
        priorityReason: reason,
        responseDeadline: formatDateTime(draft.deadline),
        instruction: "Explique a prioridade em uma frase e peça para conferir e confirmar o rascunho.",
      };
    });
  },
});

export const draftTicketUpdate = createTool({
  id: "draftTicketUpdate",
  description:
    "Monta o RASCUNHO de uma atualização (comentário) num chamado existente do funcionário. " +
    "Se o chamado foi resolvido há até 7 dias, a confirmação o reabre. Não altera nada até a confirmação.",
  inputSchema: z.object({
    code: z.string().regex(/^(INC|REQ)-\d+$/i),
    comment: z.string().min(5).max(600).describe("Informação nova, escrita para o analista"),
  }),
  execute: async ({ code, comment }, context) => {
    const turn = turnFrom(context);

    return attempt(turn, `não conseguiu preparar a atualização do ${code.toUpperCase()}`, async () => {
      const draft = await turn.services.drafts.proposeUpdate(turn.conversationId, turn.employee.id, { ticketCode: code, comment });
      if (draft.kind !== "update") throw new Error("rascunho inesperado");

      turn.recorder.step(`montou a atualização do ${draft.fields.ticketCode}`, draft.fields.reopen ? "Confirmar vai reabrir o chamado" : undefined);
      turn.recorder.card({ kind: "draft", draft });
      return { draftId: draft.id, reopens: draft.fields.reopen, instruction: "Peça para conferir e confirmar." };
    });
  },
});

export const confirmDraft = createTool({
  id: "confirmDraft",
  description:
    "Confirma um rascunho que o funcionário JÁ VIU, criando ou atualizando o chamado. " +
    "Use somente quando a última mensagem dele confirmar explicitamente (ex.: 'pode criar', 'confirmo').",
  inputSchema: z.object({ draftId: z.number().int() }),
  execute: async ({ draftId }, context) => {
    const turn = turnFrom(context);
    const { drafts, tickets } = turn.services;

    return attempt(turn, `não confirmou o rascunho D-${draftId}`, async () => {
      // O rascunho tem de ser desta conversa e ter sido mostrado num turno anterior.
      const result = await drafts.confirm(draftId, turn.employee.id, {
        conversationId: turn.conversationId,
        startedAt: turn.startedAt,
      });
      const verb = result.draft.kind === "create" ? "criou" : "atualizou";
      turn.recorder.step(`${verb} o ${result.ticket.code}`, "Confirmado pelo funcionário na conversa");
      turn.recorder.card({ kind: "ticket", ticket: tickets.snapshot(result.ticket) });

      if (result.handedOff) {
        turn.recorder.handedOff = true;
        turn.recorder.step("chamou um analista", "Chamado crítico");
        turn.recorder.guardrail("Prioridade crítica: transferido automaticamente para um analista após a criação.");
      }
      return { ticketCode: result.ticket.code, handedOff: result.handedOff };
    });
  },
});

export const cancelDraft = createTool({
  id: "cancelDraft",
  description: "Descarta um rascunho quando o funcionário desistir dele.",
  inputSchema: z.object({ draftId: z.number().int() }),
  execute: async ({ draftId }, context) => {
    const turn = turnFrom(context);
    return attempt(turn, `não descartou o rascunho D-${draftId}`, async () => {
      await turn.services.drafts.cancel(draftId, turn.employee.id);
      turn.recorder.step(`descartou o rascunho D-${draftId}`);
      return { ok: true };
    });
  },
});
