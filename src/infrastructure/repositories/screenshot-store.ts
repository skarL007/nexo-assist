import { eq } from "drizzle-orm";
import type { ScreenshotStore } from "@/application/ports";
import type { ScreenshotMime } from "@/domain/screenshot";
import type { Database } from "../db/client";
import { messageScreenshots } from "../db/schema";

export class DrizzleScreenshotStore implements ScreenshotStore {
  constructor(private readonly db: Database) {}

  async put(messageId: string, mime: ScreenshotMime, bytes: Uint8Array): Promise<void> {
    await this.db.insert(messageScreenshots).values({ messageId, mime, data: Buffer.from(bytes) });
  }

  async get(messageId: string): Promise<{ mime: ScreenshotMime; bytes: Uint8Array } | null> {
    const row = await this.db.query.messageScreenshots.findFirst({ where: eq(messageScreenshots.messageId, messageId) });
    return row ? { mime: row.mime as ScreenshotMime, bytes: new Uint8Array(row.data) } : null;
  }
}
