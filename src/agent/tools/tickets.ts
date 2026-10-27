import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/domain/ticket";
import { turnFrom } from "../turn-context";
import { attempt, formatDateTime } from "./shared";

export const listMyTickets = createTool({
  id: "listMyTickets",
  description:
    "Lista os chamados do funcionário logado. Use quando ele perguntar por um chamado sem dar o número, " +
    "ou antes de abrir um novo para evitar duplicidade. showAsChoice=true mostra uma lista para ele escolher.",
  inputSchema: z.object({
    onlyOpen: z.boolean().default(true),
    showAsChoice: z.boolean().default(false).describe("Mostrar como lista de seleção quando houver mais de um"),
  }),
  execute: async ({ onlyOpen, showAsChoice }, context) => {
    const turn = turnFrom(context);
    const { tickets } = turn.services;

    return attempt(turn, "não conseguiu consultar seus chamados", async () => {
      const mine = await tickets.listMine(turn.employee.id, { openOnly: onlyOpen });
      // Só abertos esconderia os resolvidos que ainda podem voltar ("travou de novo"): vão à parte.
      const reopenable = onlyOpen ? await tickets.listReopenable(turn.employee.id) : [];
      const snapshots = mine.map((t) => tickets.snapshot(t));
      turn.recorder.step(
        "consultou seus chamados",
        `${snapshots.length} ${onlyOpen ? "aberto(s)" : "no total"}${reopenable.length ? ` · ${reopenable.length} resolvido(s) que pode(m) ser reaberto(s)` : ""}`,
      );
      if (showAsChoice && snapshots.length > 1) turn.recorder.card({ kind: "ticket_choice", tickets: snapshots });

      const summary = (t: ReturnType<typeof tickets.snapshot>) => ({
        code: t.code,
        title: t.title,
        status: STATUS_LABEL[t.status],
        priority: PRIORITY_LABEL[t.priority],
        overdue: t.overdue,
      });
      return {
        tickets: snapshots.map(summary),
        reopenable: reopenable.map((t) => summary(tickets.snapshot(t))),
        hint: reopenable.length
          ? "Se o problema relatado é o mesmo de um chamado em reopenable, pergunte se é ele e use draftTicketUpdate com reopen=true."
          : undefined,
      };
    });
  },
});

export const getTicket = createTool({
  id: "getTicket",
  description: "Consulta um chamado do funcionário pelo código (ex.: INC-20311) e calcula se o prazo está vencido.",
  inputSchema: z.object({ code: z.string().regex(/^(INC|REQ)-\d+$/i) }),
  execute: async ({ code }, context) => {
    const turn = turnFrom(context);
    const { tickets } = turn.services;

    return attempt(turn, `não encontrou o ${code.toUpperCase()}`, async () => {
      const snapshot = tickets.snapshot(await tickets.getMine(turn.employee.id, code));
      turn.recorder.step(`consultou o ${snapshot.code}`, `${STATUS_LABEL[snapshot.status]} · prioridade ${PRIORITY_LABEL[snapshot.priority]}`);
      if (snapshot.deadline) {
        turn.recorder.step("calculou o prazo", `${snapshot.overdue ? "Vencido desde" : "Vence"} ${formatDateTime(snapshot.deadline)}`);
      }
      turn.recorder.card({ kind: "ticket", ticket: snapshot });

      return {
        ...snapshot,
        status: STATUS_LABEL[snapshot.status],
        lastUpdate: formatDateTime(snapshot.updatedAt),
        deadline: snapshot.deadline && formatDateTime(snapshot.deadline),
        hint: snapshot.overdue ? "Prazo vencido: explique e ofereça chamar um analista." : undefined,
      };
    });
  },
});
