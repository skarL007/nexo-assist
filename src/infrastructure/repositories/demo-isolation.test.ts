import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase, type Database } from "../db/client";
import { employees, conversations, messages, tickets } from "../db/schema";
import { makeTicket } from "@/application/test-doubles";
import { DrizzleConversationRepository } from "./conversation-repository";
import { DrizzleTicketRepository } from "./ticket-repository";
import { DrizzleInsightsSource } from "./insights-source";
import { DrizzleSuggestionRepository } from "./suggestion-repository";
import { DrizzleChangeFeed } from "./change-feed";
import { replySuggestions } from "../db/schema";

const A="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
let database:Database;
beforeEach(async()=>{
  database=createDatabase("file::memory:",undefined);
  await migrate(database,{migrationsFolder:"drizzle"});
  for(const [scope,code] of [[A,"INC-50001"],[B,"INC-50002"]]) {
    const id=`demo:${scope}:emp-ana`;
    await database.insert(employees).values({id,name:"Ana",email:`${scope}@example.test`,role:"employee",department:"Demo",passwordChangedAt:new Date(0)});
    await database.insert(tickets).values(makeTicket({code,ownerId:id,createdAt:new Date()}));
    await database.insert(conversations).values({id:scope,employeeId:id,status:"with_agent",createdAt:new Date(),updatedAt:new Date()});
    await database.insert(messages).values({id:`msg-${scope}`,conversationId:scope,role:"employee",text:`privado-${scope}`,cards:[],createdAt:new Date()});
  }
});
describe("escopo dos dados da demo",()=>{
  it("console lista só as conversas do visitante",async()=>{
    expect((await new DrizzleConversationRepository(database,A).listRecent(200)).map(c=>c.id)).toEqual([A]);
  });
  it("conhecer o ID de outra conversa não permite lê-la",async()=>{
    expect(await new DrizzleConversationRepository(database,B).findById(A)).toBeNull();
  });
  it("incidentes conhecidos não usam chamados de outros espaços",async()=>{
    expect((await new DrizzleTicketRepository(database,A).listOpenCreatedSince(new Date(0))).map(t=>t.code)).toEqual(["INC-50001"]);
  });
  it("indicadores não leem mensagens de outra pessoa",async()=>{
    expect((await new DrizzleInsightsSource(database,B).messagesSince(new Date(0))).map(m=>m.text)).toEqual([`privado-${B}`]);
  });
  it("indicadores não contam sugestões de outro visitante", async () => {
    await database.insert(replySuggestions).values({ conversationId: A, analystId: `demo:${A}:emp-ana`, outcome: "generated", createdAt: new Date() });
    expect((await new DrizzleSuggestionRepository(database, B).countsSince(new Date(0))).generated).toBe(0);
  });
  it("eventos de outro espaço não alteram a versão do console", async () => {
    const feed = new DrizzleChangeFeed(database, B);
    const before = await feed.consoleVersion();
    await database.insert(messages).values({ id: "another-a", conversationId: A, role: "employee", text: "outra mensagem", cards: [], createdAt: new Date() });
    expect(await feed.consoleVersion()).toBe(before);
    await database.insert(messages).values({ id: "another-b", conversationId: B, role: "employee", text: "mensagem deste espaço", cards: [], createdAt: new Date() });
    expect(await feed.consoleVersion()).not.toBe(before);
  });
});
