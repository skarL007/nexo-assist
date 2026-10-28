/**
 * Tabelas do banco (SQLite/libSQL). Local é um arquivo; no deploy é o Turso.
 * Colunas JSON guardam estruturas que só são lidas inteiras (cards, trace).
 */
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ConversationStatus, HandoffReason } from "@/domain/conversation";
import type { EmployeeRole } from "@/domain/employee";
import type { Card, DraftKind, DraftStatus, MessageRole, NewTicketFields, TicketUpdateFields, TurnTrace } from "@/domain/message";
import type { Category, Impact, Priority, TicketStatus, TicketType } from "@/domain/ticket";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").$type<EmployeeRole>().notNull(),
  department: text("department").notNull(),
  passwordChangedAt: timestamp("password_changed_at").notNull(),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
});

export const tickets = sqliteTable("tickets", {
  code: text("code").primaryKey(),
  type: text("type").$type<TicketType>().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").$type<Category>().notNull(),
  priority: text("priority").$type<Priority>().notNull(),
  status: text("status").$type<TicketStatus>().notNull(),
  impact: text("impact").$type<Impact>().notNull(),
  ownerId: text("owner_id").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (t) => [index("tickets_owner_idx").on(t.ownerId)]);

export const ticketComments = sqliteTable("ticket_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketCode: text("ticket_code").notNull().references(() => tickets.code),
  author: text("author").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  status: text("status").$type<ConversationStatus>().notNull(),
  analystId: text("analyst_id").references(() => employees.id),
  handoffReason: text("handoff_reason").$type<HandoffReason>(),
  handoffSummary: text("handoff_summary"),
  handoffTicketCode: text("handoff_ticket_code"),
  handoffConfidence: integer("handoff_confidence"), // 0–100
  handoffAt: timestamp("handoff_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (t) => [index("conversations_employee_idx").on(t.employeeId, t.status), index("conversations_updated_idx").on(t.updatedAt)]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  role: text("role").$type<MessageRole>().notNull(),
  authorName: text("author_name"),
  text: text("text").notNull(),
  cards: text("cards", { mode: "json" }).$type<Card[]>().notNull(),
  trace: text("trace", { mode: "json" }).$type<TurnTrace>(),
  createdAt: timestamp("created_at").notNull(),
}, (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt), index("messages_role_created_idx").on(t.role, t.createdAt)]);

/** "Isso resolveu?": uma avaliação por resposta do agent (avaliar de novo troca). */
export const messageFeedback = sqliteTable("message_feedback", {
  messageId: text("message_id").primaryKey().references(() => messages.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  helpful: integer("helpful", { mode: "boolean" }).notNull(),
  createdAt: timestamp("created_at").notNull(),
}, (t) => [index("message_feedback_created_idx").on(t.createdAt)]);

/** Contadores globais com teto (ex.: respostas do modelo no total). Reservados de forma atômica. */
export const usageCounters = sqliteTable("usage_counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  kind: text("kind").$type<DraftKind>().notNull(),
  status: text("status").$type<DraftStatus>().notNull(),
  fields: text("fields", { mode: "json" }).$type<NewTicketFields | TicketUpdateFields>().notNull(),
  createdAt: timestamp("created_at").notNull(),
}, (t) => [index("drafts_conversation_idx").on(t.conversationId)]);
