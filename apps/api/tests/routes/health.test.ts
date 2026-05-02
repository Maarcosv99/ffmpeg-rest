import { describe, expect, test } from "bun:test";
import type { Redis } from "@ffmpeg-rest/redis";
import { createApp } from "../../src/app.ts";
import { createFakeEnv, createFakeQueues } from "../helpers/test-app.ts";

function fakeRedis(pingResult: () => Promise<string>): Redis {
  // biome-ignore lint/suspicious/noExplicitAny: minimal stub
  return { ping: pingResult } as any;
}

describe("GET /health", () => {
  test("returns 200 when redis pings PONG", async () => {
    const app = createApp({
      queues: createFakeQueues(),
      redis: fakeRedis(async () => "PONG"),
      env: createFakeEnv(),
    });
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", redis: "ok" });
  });

  test("returns 503 when redis ping returns non-PONG", async () => {
    const app = createApp({
      queues: createFakeQueues(),
      redis: fakeRedis(async () => "NOPE"),
      env: createFakeEnv(),
    });
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(503);
  });

  test("returns 503 when redis ping throws", async () => {
    const app = createApp({
      queues: createFakeQueues(),
      redis: fakeRedis(async () => {
        throw new Error("connection refused");
      }),
      env: createFakeEnv(),
    });
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(503);
  });
});
