import { describe, expect, test } from "bun:test";
import { loadEnv, resetEnvCache } from "../src/env.ts";

const validEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  S3_BUCKET: "test-bucket",
  S3_ACCESS_KEY: "key",
  S3_SECRET_KEY: "secret",
  S3_PUBLIC_URL: "https://pub.example.com/test-bucket",
};

describe("loadEnv", () => {
  test("parses a fully valid environment", () => {
    resetEnvCache();
    const env = loadEnv(validEnv as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(3000);
    expect(env.S3_REGION).toBe("auto");
    expect(env.MAX_INPUT_BYTES).toBe(100_000_000);
    expect(env.ALLOW_HTTP_WEBHOOKS).toBe(false);
  });

  test("S3_KEY_PREFIX defaults to empty string", () => {
    resetEnvCache();
    const env = loadEnv(validEnv as NodeJS.ProcessEnv);
    expect(env.S3_KEY_PREFIX).toBe("");
  });

  test("S3_KEY_PREFIX accepts a custom value", () => {
    resetEnvCache();
    const env = loadEnv({
      ...validEnv,
      S3_KEY_PREFIX: "outputs/",
    } as NodeJS.ProcessEnv);
    expect(env.S3_KEY_PREFIX).toBe("outputs/");
  });

  test("coerces ALLOW_HTTP_WEBHOOKS=true to boolean true", () => {
    resetEnvCache();
    const env = loadEnv({
      ...validEnv,
      ALLOW_HTTP_WEBHOOKS: "true",
    } as NodeJS.ProcessEnv);
    expect(env.ALLOW_HTTP_WEBHOOKS).toBe(true);
  });

  test("fails when REDIS_URL is missing", () => {
    resetEnvCache();
    const { REDIS_URL: _ignored, ...rest } = validEnv;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow(/Invalid environment configuration/);
  });

  test("fails when S3_ENDPOINT is not a URL", () => {
    resetEnvCache();
    expect(() => loadEnv({ ...validEnv, S3_ENDPOINT: "not-a-url" } as NodeJS.ProcessEnv)).toThrow(
      /S3_ENDPOINT/,
    );
  });

  test("fails when MAX_INPUT_BYTES is negative", () => {
    resetEnvCache();
    expect(() => loadEnv({ ...validEnv, MAX_INPUT_BYTES: "-1" } as NodeJS.ProcessEnv)).toThrow(
      /MAX_INPUT_BYTES/,
    );
  });
});
