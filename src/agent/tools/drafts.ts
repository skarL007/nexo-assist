import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { classifyPriority, SLA_LABEL, URGENCIES, URGENCY_LABEL } from "@/domain/priority";
import { CATEGORIES, CATEGORY_LABEL, categoryForTitle, IMPACTS, PRIORITY_LABEL, TICKET_TYPES } from "@/domain/ticket";
import { decideWorkaround, WORKAROUND_OPTIONS } from "@/domain/workaround";
import { turnFrom } from "../turn-context";
import { attempt, formatDateTime, judgeDeadline, NEEDED_BY_DESCRIPTION } from "./shared";

const CATEGORY_DESCRIPTION =
  "access = login, senha, permissão; network = rede, Wi-Fi, VPN; hardware = equipamento; " +
  "software = programa (exceto e-mail); email = Outlook, webmail, caixa de entrada, calendário do e-mail; other = o resto";

export const draftNewTicket = createTool({
  id: "draftNewTicket",
  description:
    "Monta o RASCUNHO de um chamado novo para o funcionário conferir. Não cria o chamado. " +
    "Só chame quando souber o problema, quem é afetado (impact) e a urgência. " +
    "A prioridade é calculada pelo sistema a partir de impact × urgency. " +
    "Num INC com urgency=none em que ninguém falou de alternativa, a tool pede para perguntar antes (e mostra os botões). " +
    "Se houver chamado parecido aberto, a tool devolve os possíveis duplicados em vez do rascunho.",
  inputSchema: z.object({
    type: z.enum(TICKET_TYPES).describe("INC = algo parou ou não funciona; REQ = pedido de acesso, equipamento ou software"),
    category: z.enum(CATEGORIES).describe(CATEGORY_DESCRIPTION),
    title: z.string().min(5).max(80).describe("Título curto e específico"),
    description: z
      .string()
      .min(20)
      .max(600)
      .describe("Descrição completa para o analista não precisar perguntar de novo: o que, desde quando, ambiente, o que já tentou"),
    impact: z.enum(IMPACTS).describe("me = só o funcionário; team = a equipe dele; company = a empresa"),
    urgency: z.enum(URGENCIES).describe("blocked = não consegue trabalhar; deadline_today = compromisso hoje; has_workaround = há alternativa; none = sem urgência"),
    ignoreDuplicates: z.boolean().default(false).describe("true só depois que o funcionário disse que não é nenhum dos chamados parecidos"),
    neededBy: z.string().max(11).optional().describe(NEEDED_BY_DESCRIPTION),
  }),
  execute: async (raw, context) => {
    const turn = turnFrom(context);
    const { tickets, drafts } = turn.services;

    return attempt(turn, "não conseguiu montar o rascunho", async () => {
      // Programa de e-mail é E-mail, não Software: muda a fila de quem atende (regra de código, não do prompt).
      const category = categoryForTitle(raw.title, raw.category);
      if (category !== raw.category) {
        turn.recorder.guardrail(`Categoria corrigida de ${CATEGORY_LABEL[raw.category]} para ${CATEGORY_LABEL[category]}: programa de e-mail vai para a fila de E-mail.`);
      }
      const input = { ...raw, category };
      if (!input.ignoreDuplicates) {
        const duplicates = await tickets.findPossibleDuplicates(turn.employee.id, input);
        if (duplicates.length > 0) {
          const snapshots = duplicates.map((t) => tickets.snapshot(t));
          turn.recorder.step("verificou duplicidade", `${snapshots.length} chamado(s) parecido(s) (mesmo tipo, categoria e título): ${snapshots.map((t) => t.code).join(", ")}`);
          turn.recorder.card({ kind: "ticket_choice", tickets: snapshots });
          return {
            possibleDuplicates: snapshots.map((t) => ({ code: t.code, title: t.title, status: t.status })),
            instruction:
              "Pergunte se o problema é um destes. Se for, use draftTicketUpdate nele. Se não for, chame draftNewTicket de novo com ignoreDuplicates=true.",
          };
        }
      }
      turn.recorder.step("verificou duplicidade", "Nenhum chamado parecido aberto");

      // Incidente "sem urgência" sem saber se há alternativa: a resposta muda a prioridade, então pergunta antes (regra de código).
      const askedThisTurn = turn.recorder.cards.some((c) => c.kind === "quick_replies" && c.options.includes(WORKAROUND_OPTIONS[0]));
      const workaround = askedThisTurn
        ? null
        : decideWorkaround(input, [...(await turn.services.messages.listRecent(turn.conversationId, 20)), { role: "agent", text: "", cards: turn.recorder.cards }]);
      if (!workaround || workaround.action === "ask") {
        if (workaround) {
          const withAlt = PRIORITY_LABEL[classifyPriority(input.impact, "has_workaround").priority];
          const without = PRIORITY_LABEL[classifyPriority(input.impact, "none").priority];
          turn.recorder.step("perguntou se há alternativa", `Incidente sem urgência e nada dito sobre alternativa: com alternativa é ${withAlt}, sem é ${without}`);
          turn.recorder.card({ kind: "quick_replies", options: workaround.options });
          turn.recorder.guardrail(`Prioridade depende de haver alternativa (${withAlt} × ${without}) e ninguém falou disso: o rascunho espera a resposta.`);
        }
        return {
          draftReady: false,
          instruction:
            'Ainda NÃO há rascunho. Pergunte em uma frase se a pessoa tem outro jeito de trabalhar enquanto isso (ex.: webmail, outro computador). O sistema já mostra os botões "Tenho alternativa" e "Não tenho alternativa": não chame offerQuickReplies nem draftNewTicket de novo neste turno.',
        };
      }
      if (workaround.corrected) {
        turn.recorder.guardrail(`Urgência corrigida de "${URGENCY_LABEL[input.urgency]}" para "${URGENCY_LABEL[workaround.urgency]}": o funcionário respondeu "${WORKAROUND_OPTIONS[0]}".`);
      }
      const urgency = workaround.urgency;

      // Incidente em massa: outras pessoas relataram o mesmo agora. O impacto real é maior do que a mensagem de uma pessoa mostra.
      const issue = await tickets.knownIssueFor(turn.employee.id, input);
      let impact = input.impact;
      if (issue) {
        turn.recorder.step("viu um incidente em massa", `${issue.people} pessoas relataram ${CATEGORY_LABEL[issue.category]} (${issue.terms.join(", ")}) desde ${formatDateTime(issue.since)}`);
        if (impact === "me") {
          impact = "team";
          turn.recorder.guardrail(`Incidente em massa: ${issue.people} pessoas relataram o mesmo problema nas últimas 4 horas úteis; o impacto subiu de "só eu" para "equipe" e a prioridade foi recalculada.`);
        }
      }

      const { priority, reason } = classifyPriority(impact, urgency);
      turn.recorder.step("classificou a prioridade", reason);

      const draft = await drafts.proposeNewTicket(turn.conversationId, turn.employee.id, {
        type: input.type,
        category: input.category,
        title: input.title,
        description: input.description,
        impact,
        urgency,
        priority,
        priorityReason: reason,
      });
      if (draft.kind !== "create") throw new Error("rascunho inesperado");

      turn.recorder.step("consultou o SLA", `${SLA_LABEL[priority]} → resposta até ${formatDateTime(draft.deadline)}`);
      turn.recorder.step("montou o rascunho", `D-${draft.id}`);
      turn.recorder.card({ kind: "draft", draft });
      const need = judgeDeadline(turn, new Date(draft.deadline), input.neededBy);

      return {
        draftId: draft.id,
        priority,
        priorityReason: reason,
        responseDeadline: formatDateTime(draft.deadline),
        ...(need ? { deadlineMeetsNeed: need.deadlineMeetsNeed, deadlineInstruction: need.instruction } : {}),
        ...(issue
          ? {
              knownIssue: { category: CATEGORY_LABEL[issue.category], people: issue.people, since: formatDateTime(issue.since) },
              instruction:
                "Outras pessoas relataram o mesmo problema agora: diga que é um problema conhecido e que o service desk já está acompanhando, SEM citar nomes nem números de chamados de outras pessoas. Explique a prioridade em uma frase e peça para conferir e confirmar o rascunho.",
            }
          : { instruction: "Explique a prioridade em uma frase e peça para conferir e confirmar o rascunho." }),
      };
    });
  },
});

export const draftTicketUpdate = createTool({
  id: "draftTicketUpdate",
  description:
    "Monta o RASCUNHO de uma atualização (comentário) num chamado existente do funcionário. " +
    "Se o chamado foi resolvido há até 7 dias, a confirmação o reabre. Não altera nada até a confirmação. " +
    "Só para o MESMO problema do chamado: problema de outra categoria é recusado (proponha um chamado novo).",
  inputSchema: z.object({
    code: z.string().regex(/^(INC|REQ)-\d+$/i),
    comment: z.string().min(5).max(600).describe("Informação nova, escrita para o analista"),
    category: z.enum(CATEGORIES).describe(`Categoria do problema que o comentário descreve (${CATEGORY_DESCRIPTION})`),
  }),
  execute: async ({ code, comment, category }, context) => {
    const turn = turnFrom(context);

    return attempt(turn, `não conseguiu preparar a atualização do ${code.toUpperCase()}`, async () => {
      const draft = await turn.services.drafts.proposeUpdate(turn.conversationId, turn.employee.id, { ticketCode: code, comment, category });
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
    "Use somente quando a última mensagem dele confirmar explicitamente (ex.: 'pode criar', 'confirmo'). " +
    "Resposta a outra pergunta (ex.: clique numa resposta rápida de urgência) não é confirmação, e o sistema recusa.",
  inputSchema: z.object({ draftId: z.number().int() }),
  execute: async ({ draftId }, context) => {
    const turn = turnFrom(context);
    const { drafts, tickets } = turn.services;

    return attempt(turn, `não confirmou o rascunho D-${draftId}`, async () => {
      // O rascunho tem de ser desta conversa e ter sido mostrado num turno anterior.
      const result = await drafts.confirm(draftId, turn.employee.id, {
        conversationId: turn.conversationId,
        startedAt: turn.startedAt,
        employeeText: turn.employeeText,
      });
      const verb = result.draft.kind === "create" ? "criou" : "atualizou";
      turn.recorder.step(`${verb} o ${result.ticket.code}`, "Confirmado pelo funcionário na conversa");
      turn.recorder.card({ kind: "ticket", ticket: tickets.snapshot(result.ticket) });

      if (result.handedOff) {
        turn.recorder.handedOff = true;
        turn.recorder.step("chamou um analista", "Chamado crítico");
        turn.recorder.guardrail("Prioridade crítica: transferido automaticamente para um analista após a criação.");
      }
      if (result.escalationFailed) {
        turn.recorder.step("chamou um analista", "Chamado crítico criado, mas a transferência falhou", false);
        return {
          ticketCode: result.ticket.code,
          handedOff: false,
          instruction: "Diga que o chamado foi criado, mas que não conseguiu chamar o analista agora; ofereça tentar de novo (transferToAnalyst).",
        };
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
