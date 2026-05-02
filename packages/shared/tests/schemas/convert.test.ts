import { describe, expect, test } from "bun:test";
import { ConvertRequestSchema } from "../../src/schemas/convert.ts";

describe("ConvertRequestSchema", () => {
  test("accepts a minimal valid request", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a fully populated request with webhook", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
      bitrate: "64k",
      webhook: {
        url: "https://hook.example.com/notify",
        metadata: { orderId: "abc-123" },
        secret: "this-is-at-least-16-chars",
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts webhook with only url (metadata and secret optional)", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: { url: "https://hook.example.com/notify" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects unknown format", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "wma",
    });
    expect(result.success).toBe(false);
  });

  test("rejects bitrate without 'k' suffix", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
      bitrate: "64",
    });
    expect(result.success).toBe(false);
  });

  test("rejects non-URL input", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "not-a-url",
      format: "opus",
    });
    expect(result.success).toBe(false);
  });

  test("rejects webhook.secret shorter than 16 chars", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: {
        url: "https://hook.example.com/notify",
        secret: "tooshort",
      },
    });
    expect(result.success).toBe(false);
  });

  test("rejects webhook with non-URL url field", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: { url: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects webhook without url field", () => {
    const result = ConvertRequestSchema.safeParse({
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: { metadata: { x: 1 } },
    });
    expect(result.success).toBe(false);
  });
});
