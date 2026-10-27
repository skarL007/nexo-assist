import { eq, inArray } from "drizzle-orm";
import type { ArticleRepository, EmployeeRepository } from "@/application/ports";
import type { Employee } from "@/domain/employee";
import type { Article } from "@/domain/knowledge";
import type { Database } from "../db/client";
import { articles, employees } from "../db/schema";

export class DrizzleEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Employee | null> {
    return (await this.db.query.employees.findFirst({ where: eq(employees.id, id) })) ?? null;
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const normalized = email.trim().toLowerCase();
    return (await this.db.query.employees.findFirst({ where: eq(employees.email, normalized) })) ?? null;
  }

  async listByIds(ids: string[]): Promise<Employee[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(employees).where(inArray(employees.id, ids));
  }
}

export class DrizzleArticleRepository implements ArticleRepository {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<Article[]> {
    return this.db.select().from(articles);
  }
}
