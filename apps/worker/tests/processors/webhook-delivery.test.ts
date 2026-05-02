import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { createServer } from "node:http";
import type { Env, WebhookDeliveryJobPayload, WebhookPayload } from "@ffmpeg-rest/shared";
import { verifySignature } from "@ffmpeg-rest/shared";
import { createWebhookDeliveryProcessor } from "../../src/processors/webhook-delivery.ts";

const BASE_ENV: Env = {
  NODE_ENV: "test",
  PORT: 3000,
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "https://example.test",
  S3_BUCKET: "t",
  S3_ACCESS_KEY: "k",
  S3_SECRET_KEY: "s",
  S3_PUBLIC_URL: "https://example.test/t",
  S3_REGION: "auto",
  MAX_INPUT_BYTES: 100_000_000,
  JOB_CONCURRENCY: 1,
  WEBHOOK_CONCURRENCY: 1,
  ALLOW_HTTP_WEBHOOKS: true,
  FFMPEG_TIMEOUT_MS: 5_000,
};

type Captured = {
  headers: Record<string, string>;
  body: string;
};

let server: Server;
let port: number;
let nextResponseStatus = 200;
const captured: Captured[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      captured.push({
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v ?? "")]),
        ),
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.statusCode = nextResponseStatus;
      if (nextResponseStatus >= 300 && nextResponseStatus < 400) {
        res.setHeader("location", "http://example.com/elsewhere");
      }
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address && typeof address === "object") port = address.port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function makeJob(payload: WebhookPayload, secret?: string) {
  return {
    data: {
      url: `http://127.0.0.1:${port}/hook`,
      payload,
      ...(secret !== undefined ? { secret } : {}),
    } satisfies WebhookDeliveryJobPayload,
  } as never;
}

const samplePayload: WebhookPayload = {
  jobId: "job-1",
  status: "completed",
  outputUrl: "https://example.com/out.opus",
  error: null,
  metadata: { custom: 1 },
};

describe("webhook-delivery processor", () => {
  test("delivers POST with X-Job-Id and ok status", async () => {
    captured.length = 0;
    nextResponseStatus = 200;
    const process = createWebhookDeliveryProcessor({
      env: BASE_ENV,
      validate: async () => ({ ok: true }),
    });
    const result = await process(makeJob(samplePayload));
    expect(result.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.headers["x-job-id"]).toBe("job-1");
    expect(captured[0]?.headers["x-signature"]).toBeUndefined();
    const parsed = JSON.parse(captured[0]?.body ?? "{}");
    expect(parsed.jobId).toBe("job-1");
  });

  test("includes valid HMAC X-Signature when secret provided", async () => {
    captured.length = 0;
    nextResponseStatus = 200;
    const secret = "this-is-a-strong-secret";
    const process = createWebhookDeliveryProcessor({
      env: BASE_ENV,
      validate: async () => ({ ok: true }),
    });
    await process(makeJob(samplePayload, secret));
    const sig = captured[0]?.headers["x-signature"] ?? "";
    expect(sig).toMatch(/^sha256=/);
    expect(verifySignature(captured[0]?.body ?? "", secret, sig)).toBe(true);
  });

  test("treats 3xx response as failure (no redirect follow)", async () => {
    captured.length = 0;
    nextResponseStatus = 302;
    const process = createWebhookDeliveryProcessor({
      env: BASE_ENV,
      validate: async () => ({ ok: true }),
    });
    let caught: unknown;
    try {
      await process(makeJob(samplePayload));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/redirect/);
  });

  test("throws when webhook returns 5xx", async () => {
    captured.length = 0;
    nextResponseStatus = 503;
    const process = createWebhookDeliveryProcessor({
      env: BASE_ENV,
      validate: async () => ({ ok: true }),
    });
    let caught: unknown;
    try {
      await process(makeJob(samplePayload));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/503/);
  });

  test("rejects URL pointing to private IP at delivery time", async () => {
    const env: Env = { ...BASE_ENV, ALLOW_HTTP_WEBHOOKS: false };
    const process = createWebhookDeliveryProcessor({ env });
    const job = {
      data: {
        url: "https://10.0.0.1/hook",
        payload: samplePayload,
      },
    } as never;
    let caught: unknown;
    try {
      await process(job);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Webhook URL rejected/);
  });
});
