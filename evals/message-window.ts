/**
 * Janela de mensagens limpa para o eval.
 *
 * O app recusa mais de EMPLOYEE_MESSAGES_PER_HOUR por hora e EMPLOYEE_MESSAGES_PER_DAY por dia
 * de cada pessoa (`DomainError("message_limit")`). Os runners tocam todos os cenários com os
 * mesmos funcionários do seed (quase sempre a Ana) no mesmo banco; sem este reset, os últimos
 * cenários bateriam no limite e o resultado não diria nada sobre o agent.
 *
 * O banco do eval é descartável (`npm run db:setup` o recria a cada execução), então recuamos a
 * data das mensagens recentes da pessoa para fora da janela de um dia, em vez de apagar: nada
 * some, a ordem na conversa se mantém e o código de produção (src/) não muda nem ganha chave.
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { conversations, messages } from "@/infrastructure/db/schema";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Um dia e uma hora: sai das duas janelas do limite (1 h e 24 h) com folga de relógio. */
const SHIFT_MS = DAY_MS + HOUR_MS;

/** Recua as mensagens das últimas 24 h de todas as conversas da pessoa. Devolve quantas moveu. */
export async function freeMessageWindow(db: Database, employeeId: string, now = Date.now()): Promise<number> {
  const moved = await db
    .update(messages)
    .set({ createdAt: sql`${messages.createdAt} - ${SHIFT_MS}` })
    .where(
      and(
        inArray(messages.conversationId, db.select({ id: conversations.id }).from(conversations).where(eq(conversations.employeeId, employeeId))),
        gte(messages.createdAt, new Date(now - DAY_MS)),
      ),
    )
    .returning({ id: messages.id });
  return moved.length;
}
