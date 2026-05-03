import type { Redis } from "@ffmpeg-rest/redis";
import type { ConvertAudioJobPayload, Env } from "@ffmpeg-rest/shared";
import { createApp } from "../../src/app.ts";
import type { Queues } from "../../src/queues.ts";

export type FakeJob = { id: string; data: ConvertAudioJobPayload };

export type FakeQueues = Queues & {
  added: FakeJob[];
};

let counter = 0;

export function createFakeQueues(): FakeQueues {
  const added: FakeJob[] = [];
  const fake = {
    added,
    convertAudio: {
      // biome-ignore lint/suspicious/noExplicitAny: test stub returns minimal Job shape
      add: async (_name: string, data: ConvertAudioJobPayload): Promise<any> => {
        const id = `test-job-${++counter}`;
        added.push({ id, data });
        return { id };
      },
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      getJob: async (_id: string): Promise<any> => null,
    },
    webhookDelivery: {
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      add: async (): Promise<any> => ({ id: `webhook-job-${++counter}` }),
    },
    close: async () => {},
  } as unknown as FakeQueues;
  return fake;
}

export function createFakeRedis(): Redis {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: test stub returns minimal Redis shape
    ping: async (): Promise<any> => "PONG",
    quit: async () => "OK",
  } as unknown as Redis;
}

export function createFakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    REDIS_URL: "redis://localhost:6379",
    S3_ENDPOINT: "https://example.test",
    S3_BUCKET: "test",
    S3_ACCESS_KEY: "key",
    S3_SECRET_KEY: "secret",
    S3_PUBLIC_URL: "https://example.test/bucket",
    S3_REGION: "auto",
    S3_KEY_PREFIX: "",
    MAX_INPUT_BYTES: 100_000_000,
    JOB_CONCURRENCY: 2,
    WEBHOOK_CONCURRENCY: 10,
    ALLOW_HTTP_WEBHOOKS: false,
    FFMPEG_TIMEOUT_MS: 300_000,
    ...overrides,
  };
}

export function createTestApp(envOverrides: Partial<Env> = {}) {
  const queues = createFakeQueues();
  const redis = createFakeRedis();
  const env = createFakeEnv(envOverrides);
  const app = createApp({ queues, redis, env });
  return { app, queues, redis, env };
}
