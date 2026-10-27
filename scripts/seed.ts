/**
 * Recria os dados de exemplo: apaga tudo e insere funcionários, artigos,
 * chamados e algumas conversas para o console do analista não começar vazio.
 */
import { createDatabase } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { ago, articles, employees, tickets } from "@/infrastructure/db/seed-data";
import type { Card } from "@/domain/message";

const db = createDatabase();

interface SeedMessage {
  role: "employee" | "agent" | "analyst" | "system";
  text: string;
  minutesAgo: number;
  cards?: Card[];
}

async function seedConversation(
  id: string,
  employeeId: string,
  conversation: Partial<typeof schema.conversations.$inferInsert>,
  messages: SeedMessage[],
) {
  const updatedAt = ago(Math.min(...messages.map((m) => m.minutesAgo)) * 60_000);
  await db.insert(schema.conversations).values({
    id,
    employeeId,
    status: "with_agent",
    createdAt: ago(Math.max(...messages.map((m) => m.minutesAgo)) * 60_000),
    updatedAt,
    ...conversation,
  });
  await db.insert(schema.messages).values(
    messages.map((m, i) => ({
      id: `${id}-m${i}`,
      conversationId: id,
      role: m.role,
      authorName: m.role === "analyst" ? "Rafael Lima" : null,
      text: m.text,
      cards: m.cards ?? [],
      trace: null,
      createdAt: ago(m.minutesAgo * 60_000),
    })),
  );
}

async function main() {
  // Ordem importa por causa das chaves estrangeiras. Zerar usage_counters reinicia o teto total.
  for (const table of [schema.usageCounters, schema.drafts, schema.messages, schema.conversations, schema.ticketComments, schema.tickets, schema.articles, schema.employees]) {
    await db.delete(table);
  }

  await db.insert(schema.employees).values(employees());
  await db.insert(schema.articles).values(articles);
  await db.insert(schema.tickets).values(tickets());

  await seedConversation(
    "conv-carla",
    "emp-carla",
    {
      status: "waiting_analyst",
      handoffReason: "employee_request",
      handoffSummary: "Carla precisa de perfil de aprovação no SAP para fechar pedidos ainda hoje (INC-20320). Pediu para falar com um analista.",
      handoffTicketCode: "INC-20320",
      handoffAt: ago(25 * 60_000),
    },
    [
      { role: "employee", text: "Preciso de acesso de aprovação no SAP ainda hoje, tenho pedidos para fechar.", minutesAgo: 32 },
      { role: "agent", text: "Encontrei o seu INC-20320, aberto há 3 horas com prioridade alta. O prazo de resposta ainda não venceu.", minutesAgo: 31 },
      { role: "employee", text: "Prefiro falar com alguém, é urgente.", minutesAgo: 26 },
      { role: "system", text: "Transferido para o service desk · Funcionário pediu um analista", minutesAgo: 25 },
    ],
  );

  await seedConversation(
    "conv-bruno",
    "emp-bruno",
    {
      status: "waiting_analyst",
      handoffReason: "low_confidence",
      handoffSummary: "Bruno quer instalar um plugin de IA no Figma usando a licença do time. Não está claro se é software homologado ou requisição com aprovação.",
      handoffConfidence: 41,
      handoffAt: ago(50 * 60_000),
    },
    [
      { role: "employee", text: "Posso instalar um plugin de IA no Figma com a licença do time? Ele pede acesso aos arquivos.", minutesAgo: 52 },
      { role: "system", text: "Transferido para o service desk · Agent sem segurança para decidir", minutesAgo: 50 },
      { role: "agent", text: "Vou chamar um analista para te ajudar com isso, ele já recebe o resumo da conversa.", minutesAgo: 50 },
    ],
  );

  await seedConversation("conv-elisa", "emp-elisa", {}, [
    { role: "employee", text: "O Wi-Fi da sala 3 voltou a cair.", minutesAgo: 12 },
    { role: "agent", text: "Seu INC-20319 está em andamento e foi atualizado há 5 horas. Quer que eu acrescente que voltou a cair hoje?", minutesAgo: 11 },
  ]);

  await seedConversation("conv-diego", "emp-diego", { status: "closed" }, [
    { role: "employee", text: "Qual o horário do service desk?", minutesAgo: 3 * 60 },
    { role: "agent", text: "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.", minutesAgo: 3 * 60 - 1 },
    { role: "employee", text: "Isso resolveu, obrigado!", minutesAgo: 3 * 60 - 2 },
  ]);

  console.log(`✔ seed concluído (${employees().length} pessoas, ${articles.length} artigos, ${tickets().length} chamados)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
