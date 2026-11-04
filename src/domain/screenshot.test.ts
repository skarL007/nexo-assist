import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { assertScreenshotQuota, checkScreenshot, detectImageMime, SCREENSHOT_MAX_BYTES, SCREENSHOTS_PER_CONVERSATION } from "./screenshot";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("detectImageMime: o tipo vem dos primeiros bytes, não do nome", () => {
  it("reconhece PNG, JPEG e WebP", () => {
    expect(detectImageMime(png)).toBe("image/png");
    expect(detectImageMime(jpeg)).toBe("image/jpeg");
    expect(detectImageMime(webp)).toBe("image/webp");
  });

  it("GIF, SVG e bytes curtos não são captura", () => {
    expect(detectImageMime(gif)).toBeNull();
    expect(detectImageMime(svg)).toBeNull();
    expect(detectImageMime(Uint8Array.from([0x89, 0x50]))).toBeNull();
  });
});

describe("checkScreenshot", () => {
  it("devolve o tipo real quando bate com o declarado", () => {
    expect(checkScreenshot(png, "image/png")).toBe("image/png");
  });

  it("SVG declarado como PNG é recusado (os bytes mandam)", () => {
    expect(() => checkScreenshot(svg, "image/png")).toThrow(DomainError);
    expect(() => checkScreenshot(svg, "image/png")).toThrow(/PNG, JPEG ou WebP/);
  });

  it("tipo declarado diferente do real é recusado", () => {
    expect(() => checkScreenshot(jpeg, "image/png")).toThrow(/PNG, JPEG ou WebP/);
  });

  it("acima de 1 MB é recusado; exatamente 1 MB passa", () => {
    const big = new Uint8Array(SCREENSHOT_MAX_BYTES + 1);
    big.set(png);
    expect(() => checkScreenshot(big, "image/png")).toThrow(/1 MB/);
    expect(checkScreenshot(big.subarray(0, SCREENSHOT_MAX_BYTES), "image/png")).toBe("image/png");
  });
});

describe("assertScreenshotQuota: no máximo 5 capturas por conversa", () => {
  it("com 4 já enviadas, a quinta passa; com 5, a sexta é recusada", () => {
    expect(SCREENSHOTS_PER_CONVERSATION).toBe(5);
    expect(() => assertScreenshotQuota(4)).not.toThrow();
    expect(() => assertScreenshotQuota(5)).toThrow(/5 capturas/);
  });
});
