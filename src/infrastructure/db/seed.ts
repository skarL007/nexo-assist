/**
 * Dados de exemplo: apaga tudo e insere funcionários, artigos, chamados e
 * algumas conversas para o console do analista não começar vazio.
 * Usado por `npm run db:seed` (scripts/seed.ts) e pelo preparo da imagem Docker (bootstrap.ts).
 */
import type { Card, TurnTrace } from "@/domain/message";
import type { Database } from "./client";
import * as schema from "./schema";
import { ago, articles, employees, tickets } from "./seed-data";

const CARLA_SUMMARY = "Carla precisa de perfil de aprovação no SAP para fechar pedidos ainda hoje (INC-20320). Pediu para falar com um analista.";
const BRUNO_SUMMARY =
  "Bruno quer instalar um plugin de IA no Figma usando a licença do time. Não está claro se é software homologado ou requisição com aprovação.";

interface SeedMessage {
  role: "employee" | "agent" | "analyst" | "system";
  text: string;
  minutesAgo: number;
  cards?: Card[];
  trace?: TurnTrace;
}

/** Turno do agent em que a busca na central não achou nada (vira "Lacunas da central" nos indicadores). */
const searchMiss = (query: string): TurnTrace => ({
  decision: { intent: "new_ticket", understanding: "Projetor da sala de reunião sem funcionar", confidence: 0.82, reasoning: "" },
  steps: [{ label: "buscou na central de ajuda", detail: `Nada encontrado para "${query}"`, ok: true }],
  toolCalls: [{ tool: "searchHelpCenter", input: { query }, output: { articles: [] }, durationMs: 310 }],
  guardrails: [],
  model: "google/gemini-3.5-flash",
  usage: { inputTokens: 2300, outputTokens: 90 },
  latencyMs: 2600,
});

async function seedConversation(
  db: Database,
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
      trace: m.trace ?? null,
      createdAt: ago(m.minutesAgo * 60_000),
    })),
  );
}

/**
 * Atualiza só a central de ajuda: insere os artigos novos do seed e reescreve os existentes.
 * Não apaga nada (nem artigo fora do seed), então roda em produção a cada deploy sem tocar
 * em conversas, chamados ou contadores. Os embeddings se recalculam sozinhos pelo hash do texto.
 */
export async function syncArticles(db: Database): Promise<number> {
  for (const article of articles) {
    const { id, ...fields } = { checks: [], ...article };
    await db.insert(schema.articles).values({ id, ...fields }).onConflictDoUpdate({ target: schema.articles.id, set: fields });
  }
  return articles.length;
}

/** Recria os dados de exemplo no banco recebido (apaga o que houver antes). */
export async function seedDemoData(db: Database) {
  // Ordem importa por causa das chaves estrangeiras. Zerar usage_counters reinicia o teto total.
  for (const table of [schema.replySuggestions, schema.articleEmbeddings, schema.messageFeedback, schema.usageCounters, schema.drafts, schema.messages, schema.conversations, schema.ticketComments, schema.tickets, schema.articles, schema.employees]) {
    await db.delete(table);
  }

  await db.insert(schema.employees).values(employees());
  await db.insert(schema.articles).values(articles);
  await db.insert(schema.tickets).values(tickets());

  await seedConversation(
    db,
    "conv-carla",
    "emp-carla",
    {
      status: "waiting_analyst",
      handoffReason: "employee_request",
      handoffSummary: CARLA_SUMMARY,
      handoffTicketCode: "INC-20320",
      handoffAt: ago(25 * 60_000),
    },
    [
      { role: "employee", text: "Preciso de acesso de aprovação no SAP ainda hoje, tenho pedidos para fechar.", minutesAgo: 32 },
      { role: "agent", text: "Encontrei o seu INC-20320, aberto há 3 horas com prioridade alta. O prazo de resposta ainda não venceu.", minutesAgo: 31 },
      { role: "employee", text: "Prefiro falar com alguém, é urgente.", minutesAgo: 26 },
      // Como numa transferência de verdade, o card fica no histórico (o relatório do console usa depois de devolver).
      {
        role: "system",
        text: "Transferido para o service desk · Funcionário pediu um analista",
        minutesAgo: 25,
        cards: [{ kind: "handoff", reason: "employee_request", summary: CARLA_SUMMARY }],
      },
      {
        role: "agent",
        text: "Chamei um analista para você, Carla. Ele já recebe o resumo da conversa.",
        minutesAgo: 25,
        // Entendimento registrado no turno da transferência: frustração alta (chip e ordem na fila do console).
        trace: {
          decision: {
            intent: "talk_to_analyst",
            understanding: "Carla quer falar com um analista: precisa do acesso de aprovação no SAP hoje",
            confidence: 0.93,
            reasoning: "Pediu uma pessoa explicitamente.",
            frustration: "high",
            frustrationReason: "urgente: precisa fechar pedidos hoje e o acesso ainda não saiu",
          },
          steps: [],
          toolCalls: [],
          guardrails: [],
          model: null,
          usage: null,
          latencyMs: 0,
        },
      },
    ],
  );

  await seedConversation(
    db,
    "conv-bruno",
    "emp-bruno",
    {
      status: "waiting_analyst",
      handoffReason: "low_confidence",
      handoffSummary: BRUNO_SUMMARY,
      handoffConfidence: 41,
      handoffAt: ago(50 * 60_000),
    },
    [
      { role: "employee", text: "Posso instalar um plugin de IA no Figma com a licença do time? Ele pede acesso aos arquivos.", minutesAgo: 52 },
      {
        role: "system",
        text: "Transferido para o service desk · Agent sem segurança para decidir",
        minutesAgo: 50,
        cards: [{ kind: "handoff", reason: "low_confidence", summary: BRUNO_SUMMARY }],
      },
      { role: "agent", text: "Vou chamar um analista para te ajudar com isso, ele já recebe o resumo da conversa.", minutesAgo: 50 },
    ],
  );

  await seedConversation(db, "conv-elisa", "emp-elisa", {}, [
    { role: "employee", text: "O Wi-Fi da sala 3 voltou a cair.", minutesAgo: 12 },
    { role: "agent", text: "Seu INC-20319 está em andamento e foi atualizado há 5 horas. Quer que eu acrescente que voltou a cair hoje?", minutesAgo: 11 },
  ]);

  await seedConversation(db, "conv-diego", "emp-diego", { status: "closed" }, [
    { role: "employee", text: "Qual o horário do service desk?", minutesAgo: 3 * 60 },
    { role: "agent", text: "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.", minutesAgo: 3 * 60 - 1 },
    { role: "employee", text: "Isso resolveu, obrigado!", minutesAgo: 3 * 60 - 2 },
  ]);

  // Três pessoas, mesmo tema, nenhum artigo (a central não fala de projetor): uma lacuna. O CPF do exemplo sai mascarado.
  const projector: [string, string, string, number][] = [
    ["emp-gustavo", "O projetor da sala 5 não liga, tenho apresentação daqui a pouco.", "projetor sala 5 não liga", 26],
    ["emp-helena", "Projetor da sala de reunião sem sinal no HDMI. Meu CPF é 123.456.789-09 se precisar.", "projetor sala reunião sem sinal hdmi", 30],
    ["emp-igor", "projetor da sala 5 não reconhece o notebook", "projetor sala notebook não reconhece", 50],
  ];
  for (const [employeeId, text, query, hoursAgo] of projector) {
    const minutes = hoursAgo * 60;
    await seedConversation(db, `conv-projetor-${employeeId.slice(4)}`, employeeId, { status: "closed" }, [
      { role: "employee", text, minutesAgo: minutes },
      { role: "agent", text: "Não achei um artigo sobre o projetor. Vou chamar um analista para olhar.", minutesAgo: minutes - 1, trace: searchMiss(query) },
      { role: "system", text: "Transferido para o service desk · Funcionário pediu um analista", minutesAgo: minutes - 1, cards: [{ kind: "handoff", reason: "employee_request", summary: "Projetor da sala de reunião sem funcionar." }] },
    ]);
  }

  return { employees: employees().length, articles: articles.length, tickets: tickets().length };
}
