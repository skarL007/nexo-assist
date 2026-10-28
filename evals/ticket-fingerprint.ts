/**
 * Retrato dos chamados no banco do eval: código → status, data de atualização e nº de comentários.
 * Comparar antes e depois de um cenário mostra se algum chamado foi criado ou mexido.
 */
import { count } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { ticketComments, tickets } from "@/infrastructure/db/schema";

export async function ticketFingerprint(): Promise<Map<string, string>> {
  const rows = await db().select({ code: tickets.code, status: tickets.status, updatedAt: tickets.updatedAt }).from(tickets);
  const comments = await db().select({ code: ticketComments.ticketCode, total: count() }).from(ticketComments).groupBy(ticketComments.ticketCode);
  const commentsBy = new Map(comments.map((c) => [c.code, c.total]));
  return new Map(rows.map((t) => [t.code, `${t.status}|${t.updatedAt.getTime()}|${commentsBy.get(t.code) ?? 0}`]));
}
