import { randomUUID } from "node:crypto";
import { and, eq, inArray, like, lt, sql } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import type { Database } from "./db/client";
import { employees as seedEmployees, tickets as seedTickets } from "./db/seed-data";
import * as schema from "./db/schema";
import { DrizzleBudgetRepository } from "./repositories/budget-repository";

export const DEMO_LIFETIME_SECONDS=7*24*60*60;

/** Só registros de visitantes expirados; nunca toca em pessoas nem fixtures normais. */
export async function cleanupDemoWorkspaces(database:Database,now=new Date()) {
  const expired=database.select({id:schema.employees.id}).from(schema.employees).where(and(like(schema.employees.id,"demo:%"),lt(schema.employees.passwordChangedAt,new Date(now.getTime()-DEMO_LIFETIME_SECONDS*1000))));
  const people=(await expired).map(p=>p.id);
  if(!people.length)return;
  await database.transaction(async tx=>{
    const convs=tx.select({id:schema.conversations.id}).from(schema.conversations).where(inArray(schema.conversations.employeeId,people));
    const tickets=tx.select({code:schema.tickets.code}).from(schema.tickets).where(inArray(schema.tickets.ownerId,people));
    await tx.delete(schema.replySuggestions).where(inArray(schema.replySuggestions.conversationId,convs));
    await tx.delete(schema.messageFeedback).where(inArray(schema.messageFeedback.employeeId,people));
    await tx.delete(schema.drafts).where(inArray(schema.drafts.employeeId,people));
    await tx.delete(schema.messages).where(inArray(schema.messages.conversationId,convs));
    await tx.delete(schema.conversations).where(inArray(schema.conversations.employeeId,people));
    await tx.delete(schema.ticketComments).where(inArray(schema.ticketComments.ticketCode,tickets));
    await tx.delete(schema.tickets).where(inArray(schema.tickets.ownerId,people));
    await tx.delete(schema.employees).where(inArray(schema.employees.id,people));
  });
}

/** Cópia dos fixtures, jamais de dados de visitantes anteriores. */
export async function provisionDemoWorkspace(database:Database,scope:string,now=new Date()) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(scope))throw new DomainError("invalid_input","Espaço de demonstração inválido.");
  const prefix=`demo:${scope}:`;
  const existing=await database.query.employees.findFirst({where:eq(schema.employees.id,prefix+"emp-ana")});
  if(existing)return;
  const budget=new DrizzleBudgetRepository(database);
  if(!await budget.reserve(`demo_workspaces:${Math.floor(now.getTime()/3_600_000)}`,20))throw new DomainError("message_limit","Muitos visitantes novos nesta hora. Tente novamente mais tarde.");
  await cleanupDemoWorkspaces(database,now);
  await database.transaction(async tx=>{
    const found=await tx.select({id:schema.employees.id}).from(schema.employees).where(eq(schema.employees.id,prefix+"emp-ana"));
    if(found.length)return;
    const issuedAt=new Date(Math.floor(now.getTime()/1000)*1000);
    await tx.insert(schema.employees).values(seedEmployees().map(person=>({...person,id:prefix+person.id,email:person.email.replace("@",`+${scope}@`),passwordChangedAt:issuedAt})));
    const next:Record<string,number>={};
    for(const type of ["INC","REQ"] as const){
      const [row]=await tx.select({max:sql<number>`coalesce(max(cast(substr(${schema.tickets.code},5) as integer)),${type==="INC"?20000:10000})`}).from(schema.tickets).where(eq(schema.tickets.type,type));
      next[type]=Number(row.max);
    }
    const codes=new Map<string,string>();
    const templates=seedTickets();
    await tx.insert(schema.tickets).values(templates.map(ticket=>{
      const code=`${ticket.type}-${++next[ticket.type]}`;
      codes.set(ticket.code,code);
      return {...ticket,code,ownerId:prefix+ticket.ownerId};
    }));
    const at=new Date();
    const id=prefix+"conv-carla";
    const code=codes.get("INC-20320");
    await tx.insert(schema.conversations).values({id,employeeId:prefix+"emp-carla",status:"waiting_analyst",handoffReason:"employee_request",handoffSummary:`Carla pediu ajuda de um analista sobre o acesso ao SAP (${code}).`,handoffTicketCode:code,handoffAt:at,createdAt:at,updatedAt:at});
    await tx.insert(schema.messages).values({id:randomUUID(),conversationId:id,role:"employee",text:"Preciso de ajuda de um analista com o perfil de aprovação do SAP. Dados fictícios de demonstração.",cards:[],createdAt:at});
  });
}
