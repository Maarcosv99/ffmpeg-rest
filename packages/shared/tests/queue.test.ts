import { describe, expect, test } from "bun:test";
import {
  CONVERT_RETRY_OPTIONS,
  QUEUE_CONVERT_AUDIO,
  QUEUE_WEBHOOK_DELIVERY,
  WEBHOOK_RETRY_OPTIONS,
} from "../src/queue.ts";

describe("queue constants", () => {
  test("queue names are stable strings", () => {
    expect(QUEUE_CONVERT_AUDIO).toBe("convert-audio");
    expect(QUEUE_WEBHOOK_DELIVERY).toBe("webhook-delivery");
  });

  test("CONVERT_RETRY_OPTIONS uses exponential backoff with jitter", () => {
    expect(CONVERT_RETRY_OPTIONS.attempts).toBe(3);
    expect(CONVERT_RETRY_OPTIONS.backoff.type).toBe("exponential");
    expect(CONVERT_RETRY_OPTIONS.backoff.delay).toBe(5_000);
    expect(CONVERT_RETRY_OPTIONS.backoff.jitter).toBe(0.5);
  });

  test("WEBHOOK_RETRY_OPTIONS keeps the longer delay configured", () => {
    expect(WEBHOOK_RETRY_OPTIONS.attempts).toBe(5);
    expect(WEBHOOK_RETRY_OPTIONS.backoff.delay).toBe(30_000);
  });
});
