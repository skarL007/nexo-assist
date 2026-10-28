import { sql } from "drizzle-orm";
import type { ChangeFeed } from "@/application/ports";
import type { Database } from "../db/client";
import { conversations, drafts, messageFeedback, messages, tickets } from "../db/schema";

/**
 * Uma consulta por conferência, só com agregados (max/count usam os índices).
 * O count pega o que o max não pega: mensagens gravadas no mesmo milissegundo
 * e rascunhos que mudam de status sem data de atualização.
 */
export class DrizzleChangeFeed implements ChangeFeed {
  constructor(private readonly db: Database) {}

  async consoleVersion(): Promise<string> {
    const [row] = await this.db
      .select({
        conversations: sql<number | null>`(select max(${conversations.updatedAt}) from ${conversations})`,
        messages: sql<string | null>`(select max(${messages.createdAt}) || ':' || count(*) from ${messages})`,
        tickets: sql<number | null>`(select max(${tickets.updatedAt}) from ${tickets})`,
        drafts: sql<number>`(select count(*) from ${drafts} where ${drafts.status} = 'pending')`,
        feedback: sql<string | null>`(select max(${messageFeedback.createdAt}) || ':' || count(*) from ${messageFeedback})`,
      })
      .from(sql`(select 1)`);
    return Object.values(row).join("|");
  }

  async employeeVersion(employeeId: string): Promise<string> {
    // "conversations"."id" com a tabela: sem ela, dentro da subconsulta, "id" seria o da mensagem.
    const [row] = await this.db
      .select({
        id: conversations.id,
        status: conversations.status,
        updatedAt: conversations.updatedAt,
        messages: sql<string>`(select count(*) || ':' || coalesce(max(${messages.createdAt}), 0) from ${messages} where ${messages.conversationId} = "conversations"."id")`,
      })
      .from(conversations)
      .where(sql`${conversations.employeeId} = ${employeeId}`)
      .orderBy(sql`${conversations.updatedAt} desc`)
      .limit(1);
    return row ? [row.id, row.status, row.updatedAt.getTime(), row.messages].join("|") : "none";
  }
}
