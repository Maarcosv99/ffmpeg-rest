import { describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-app.ts";

function postConvert(app: ReturnType<typeof createTestApp>["app"], body: unknown) {
  return app.handle(
    new Request("http://localhost/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /convert", () => {
  test("enqueues a valid request and returns jobId", async () => {
    const { app, queues } = createTestApp();
    const res = await postConvert(app, {
      url: "https://example.com/audio.mp3",
      format: "opus",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobId: string; statusUrl: string };
    expect(body.jobId).toMatch(/^test-job-/);
    expect(body.statusUrl).toBe(`/jobs/${body.jobId}`);
    expect(queues.added).toHaveLength(1);
    expect(queues.added[0]?.data.url).toBe("https://example.com/audio.mp3");
  });

  test("returns 422 (Elysia validation) when format is invalid", async () => {
    const { app, queues } = createTestApp();
    const res = await postConvert(app, {
      url: "https://example.com/audio.mp3",
      format: "wma",
    });
    expect(res.status).toBe(422);
    expect(queues.added).toHaveLength(0);
  });

  test("returns 422 when url is missing", async () => {
    const { app } = createTestApp();
    const res = await postConvert(app, { format: "opus" });
    expect(res.status).toBe(422);
  });

  test("rejects webhook URL pointing to private IP with 400", async () => {
    const { app, queues } = createTestApp();
    const res = await postConvert(app, {
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: "https://10.0.0.1/notify",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid webhook URL");
    expect(queues.added).toHaveLength(0);
  });

  test("rejects webhook URL pointing to metadata endpoint", async () => {
    const { app } = createTestApp();
    const res = await postConvert(app, {
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: "https://169.254.169.254/latest/meta-data",
    });
    expect(res.status).toBe(400);
  });

  test("accepts valid public webhook URL", async () => {
    const { app, queues } = createTestApp();
    const res = await postConvert(app, {
      url: "https://example.com/audio.mp3",
      format: "opus",
      webhook: "https://hooks.example.com/notify",
      webhookData: { id: "abc" },
      webhookSecret: "this-is-at-least-16-chars",
    });
    expect(res.status).toBe(200);
    expect(queues.added).toHaveLength(1);
    expect(queues.added[0]?.data.webhook).toBe("https://hooks.example.com/notify");
  });
});
