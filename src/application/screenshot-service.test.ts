import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain/employee";
import { SCREENSHOTS_PER_EMPLOYEE_PER_DAY, type ScreenshotMime } from "@/domain/screenshot";
import { ConversationService } from "./conversation-service";
import type { BudgetRepository, ImageDescriber, ScreenshotStore } from "./ports";
import { ScreenshotService } from "./screenshot-service";
import { SpendLedger, type SpendStore } from "./spend-ledger";
import { fixedClock, InMemoryConversationRepository, InMemoryMessageRepository } from "./test-doubles";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const person = (id: string, role: Employee["role"] = "employee"): Employee => ({
  id,
  name: id,
  email: `${id}@nexo.com.br`,
  role,
  department: "Financeiro",
  passwordChangedAt: new Date(),
});
const carla = person("carla");
const bruno = person("bruno");
const rafael = person("rafael", "analyst");

class MemorySpend implements SpendStore {
  values = new Map<string, number>();
  async get(key: string) {
    return this.values.get(key) ?? 0;
  }
  async add(key: string, micros: number) {
    this.values.set(key, (this.values.get(key) ?? 0) + micros);
  }
}

class MemoryScreenshots implements ScreenshotStore {
  items = new Map<string, { mime: ScreenshotMime; bytes: Uint8Array }>();
  async put(messageId: string, mime: ScreenshotMime, bytes: Uint8Array) {
    this.items.set(messageId, { mime, bytes });
  }
  async get(messageId: string) {
    return this.items.get(messageId) ?? null;
  }
}

class MemoryBudget implements BudgetRepository {
  counters = new Map<string, number>();
  async reserve(key: string, limit: number) {
    const value = this.counters.get(key) ?? 0;
    if (value >= limit) return false;
    this.counters.set(key, value + 1);
    return true;
  }
  async release(key: string) {
    const value = this.counters.get(key) ?? 0;
    if (value > 0) this.counters.set(key, value - 1);
  }
}

function setup(describer: ImageDescriber | null, dailyTotal = 100) {
  const messages = new InMemoryMessageRepository();
  const conversations = new ConversationService(new InMemoryConversationRepository(), messages, fixedClock("2026-11-02T13:00:00Z"));
  const spendStore = new MemorySpend();
  const spend = new SpendLedger(spendStore, { dailyUsd: 0.07 }, fixedClock("2026-11-02T13:00:00Z"));
  const store = new MemoryScreenshots();
  const budget = new MemoryBudget();
  const service = new ScreenshotService(messages, conversations, store, describer, spend, budget, { dailyTotal }, fixedClock("2026-11-02T13:00:00Z"));
  return { messages, conversations, spendStore, store, budget, service };
}

const reads = (text: string, costUsd = 0.0001): ImageDescriber => ({ model: "deepinfra/visao", describe: async () => ({ text, costUsd }) });

async function sentWithImage(ctx: ReturnType<typeof setup>) {
  const { id } = await ctx.conversations.getOrStart("carla");
  const mime = await ctx.service.accept(id, "carla", { mime: "image/png", bytes: png });
  const message = await ctx.messages.add({ conversationId: id, role: "employee", text: "o monitor não liga", screenshot: { mime, status: "pending", description: null } });
  await ctx.service.save(message.id, mime, png);
  return message;
}

describe("ScreenshotService: leitura da imagem pelo modelo de visão", () => {
  it("grava a descrição na mensagem e registra o custo no livro-caixa", async () => {
    const ctx = setup(reads("Foto de um monitor apagado; o cabo HDMI parece solto atrás dele."));
    const message = await sentWithImage(ctx);

    const result = await ctx.service.read(message.id, "image/png", png);

    expect(result).toMatchObject({ status: "read", model: "deepinfra/visao", description: expect.stringContaining("HDMI") });
    expect(ctx.messages.items.find((m) => m.id === message.id)?.screenshot).toEqual({
      mime: "image/png",
      status: "read",
      description: "Foto de um monitor apagado; o cabo HDMI parece solto atrás dele.",
    });
    expect(ctx.spendStore.values.get("usd_micros")).toBe(100);
  });

  it("falha do modelo não derruba o turno: status failed, sem descrição, e o erro do provedor não vai para a conversa", async () => {
    const ctx = setup({ model: "deepinfra/visao", describe: async () => Promise.reject(new Error("503 upstream https://api.interna/v1 token=abc")) });
    const message = await sentWithImage(ctx);

    const result = await ctx.service.read(message.id, "image/png", png);

    expect(result).toMatchObject({ status: "failed", description: null });
    expect(ctx.messages.items.find((m) => m.id === message.id)?.screenshot?.status).toBe("failed");
    // O texto do provedor fica só no registro do servidor (cause); o passo do agent mostra um motivo fixo.
    expect(result.error).not.toContain("api.interna");
    expect(result.cause).toContain("503");
  });

  it("falha do modelo entra no livro-caixa por estimativa: a chamada pode ter sido cobrada", async () => {
    const ctx = setup({ model: "deepinfra/visao", describe: async () => Promise.reject(new Error("timeout")) });
    const message = await sentWithImage(ctx);

    await ctx.service.read(message.id, "image/png", png);

    expect(ctx.spendStore.values.get("usd_micros")).toBeGreaterThan(0);
  });

  it("sem modelo de visão configurado (off), a leitura falha com o motivo", async () => {
    const ctx = setup(null);
    const message = await sentWithImage(ctx);
    expect(await ctx.service.read(message.id, "image/png", png)).toMatchObject({ status: "failed", model: null, error: expect.stringContaining("desligad") });
  });

  it("descrição vazia conta como falha (o agent pede o erro por texto)", async () => {
    const ctx = setup(reads("   "));
    const message = await sentWithImage(ctx);
    expect((await ctx.service.read(message.id, "image/png", png)).status).toBe("failed");
  });

  it("descrição longa é cortada em 800 caracteres", async () => {
    const ctx = setup(reads("x".repeat(2000)));
    const message = await sentWithImage(ctx);
    expect((await ctx.service.read(message.id, "image/png", png)).description).toHaveLength(800);
  });
});

describe("ScreenshotService: aceitar e servir a imagem", () => {
  it("recusa a sexta captura da conversa antes de gravar", async () => {
    const ctx = setup(reads("ok"));
    const { id } = await ctx.conversations.getOrStart("carla");
    for (let i = 0; i < 5; i++) {
      await ctx.messages.add({ conversationId: id, role: "employee", text: "foto", screenshot: { mime: "image/png", status: "read", description: "ok" } });
    }
    await expect(ctx.service.accept(id, "carla", { mime: "image/png", bytes: png })).rejects.toMatchObject({ code: "message_limit" });
  });

  it("a mesma pessoa não passa do teto de imagens do dia abrindo conversas novas", async () => {
    const ctx = setup(reads("ok"));
    for (let i = 0; i < SCREENSHOTS_PER_EMPLOYEE_PER_DAY; i++) {
      await ctx.service.accept(`conversa-${i}`, "carla", { mime: "image/png", bytes: png });
    }
    await expect(ctx.service.accept("conversa-nova", "carla", { mime: "image/png", bytes: png })).rejects.toMatchObject({ code: "message_limit" });
    // Outra pessoa continua podendo anexar.
    await expect(ctx.service.accept("conversa-do-bruno", "bruno", { mime: "image/png", bytes: png })).resolves.toBe("image/png");
  });

  it("o teto global de imagens do dia recusa a seguinte, de qualquer pessoa, e devolve a vaga pessoal", async () => {
    const ctx = setup(reads("ok"), 2);
    await ctx.service.accept("c1", "carla", { mime: "image/png", bytes: png });
    await ctx.service.accept("c2", "bruno", { mime: "image/png", bytes: png });

    await expect(ctx.service.accept("c3", "ana", { mime: "image/png", bytes: png })).rejects.toMatchObject({ code: "daily_limit" });
    expect(ctx.budget.counters.get("screenshots:ana:2026-11-02")).toBe(0);
  });

  it("imagem recusada pelo formato não gasta vaga de nenhum teto", async () => {
    const ctx = setup(reads("ok"));
    await expect(ctx.service.accept("c1", "carla", { mime: "image/png", bytes: Uint8Array.from([1, 2, 3]) })).rejects.toMatchObject({ code: "invalid_input" });
    expect(ctx.budget.counters.size).toBe(0);
  });

  it("a dona da conversa e o analista veem a imagem; outro funcionário recebe not_found", async () => {
    const ctx = setup(reads("ok"));
    const message = await sentWithImage(ctx);

    expect(await ctx.service.forViewer(message.id, carla)).toEqual({ mime: "image/png", bytes: png });
    expect(await ctx.service.forViewer(message.id, rafael)).toEqual({ mime: "image/png", bytes: png });
    await expect(ctx.service.forViewer(message.id, bruno)).rejects.toMatchObject({ code: "not_found" });
  });

  it("mensagem sem imagem ou inexistente: not_found", async () => {
    const ctx = setup(reads("ok"));
    const { id } = await ctx.conversations.getOrStart("carla");
    const plain = await ctx.messages.add({ conversationId: id, role: "employee", text: "oi" });
    await expect(ctx.service.forViewer(plain.id, carla)).rejects.toMatchObject({ code: "not_found" });
    await expect(ctx.service.forViewer("nao-existe", carla)).rejects.toMatchObject({ code: "not_found" });
  });
});
