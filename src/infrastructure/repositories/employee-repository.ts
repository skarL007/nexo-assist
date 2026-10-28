import { eq, inArray } from "drizzle-orm";
import type { ArticleRepository, EmployeeRepository } from "@/application/ports";
import type { Employee } from "@/domain/employee";
import type { Article } from "@/domain/knowledge";
import type { Database } from "../db/client";
import { articleEmbeddings, articles, employees } from "../db/schema";

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

  async embeddings(model: string): Promise<Map<string, { vector: number[]; contentHash: string }>> {
    const rows = await this.db.select().from(articleEmbeddings).where(eq(articleEmbeddings.model, model));
    return new Map(rows.map((r) => [r.articleId, { vector: r.vector, contentHash: r.contentHash }]));
  }

  async saveEmbeddings(model: string, items: { articleId: string; vector: number[]; contentHash: string }[]): Promise<void> {
    for (const item of items) {
      await this.db
        .insert(articleEmbeddings)
        .values({ articleId: item.articleId, model, contentHash: item.contentHash, vector: item.vector })
        .onConflictDoUpdate({ target: [articleEmbeddings.articleId, articleEmbeddings.model], set: { contentHash: item.contentHash, vector: item.vector } });
    }
  }
}
