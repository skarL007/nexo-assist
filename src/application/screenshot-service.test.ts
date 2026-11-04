import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain/employee";
import type { ScreenshotMime } from "@/domain/screenshot";
import { ConversationService } from "./conversation-service";
import type { ImageDescriber, ScreenshotStore } from "./ports";
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

function setup(describer: ImageDescriber | null) {
  const messages = new InMemoryMessageRepository();
  const conversations = new ConversationService(new InMemoryConversationRepository(), messages, fixedClock("2026-11-02T13:00:00Z"));
  const spendStore = new MemorySpend();
  const spend = new SpendLedger(spendStore, { dailyUsd: 0.07 }, fixedClock("2026-11-02T13:00:00Z"));
  const store = new MemoryScreenshots();
  const service = new ScreenshotService(messages, conversations, store, describer, spend);
  return { messages, conversations, spendStore, store, service };
}

const reads = (text: string, costUsd = 0.0001): ImageDescriber => ({ model: "deepinfra/visao", describe: async () => ({ text, costUsd }) });

async function sentWithImage(ctx: ReturnType<typeof setup>) {
  const { id } = await ctx.conversations.getOrStart("carla");
  const mime = await ctx.service.accept(id, { mime: "image/png", bytes: png });
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

  it("falha do modelo não derruba o turno: status failed, sem descrição e sem custo", async () => {
    const ctx = setup({ model: "deepinfra/visao", describe: async () => Promise.reject(new Error("503")) });
    const message = await sentWithImage(ctx);

    const result = await ctx.service.read(message.id, "image/png", png);

    expect(result).toMatchObject({ status: "failed", description: null });
    expect(ctx.messages.items.find((m) => m.id === message.id)?.screenshot?.status).toBe("failed");
    expect(ctx.spendStore.values.size).toBe(0);
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
    await expect(ctx.service.accept(id, { mime: "image/png", bytes: png })).rejects.toMatchObject({ code: "message_limit" });
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
