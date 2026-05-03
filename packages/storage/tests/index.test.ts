import { afterEach, describe, expect, test } from "bun:test";
import { spyOn } from "bun:test";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { type StorageConfig, createStorage } from "../src/index.ts";

const config: StorageConfig = {
  endpoint: "https://example.r2.cloudflarestorage.com",
  region: "auto",
  accessKey: "AKIAIOSFODNN7EXAMPLE",
  secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  bucket: "ffmpeg-rest-test",
  publicUrl: "https://pub-test.r2.dev/ffmpeg-rest-test",
};

describe("storage.getPublicUrl", () => {
  test("encodes the key and joins with publicUrl base", () => {
    const storage = createStorage(config);
    expect(storage.getPublicUrl("outputs/abc.opus")).toBe(`${config.publicUrl}/outputs%2Fabc.opus`);
  });

  test("strips trailing slash from publicUrl base", () => {
    const storage = createStorage({ ...config, publicUrl: `${config.publicUrl}/` });
    expect(storage.getPublicUrl("a.opus")).toBe(`${config.publicUrl}/a.opus`);
  });
});

describe("storage.putObject", () => {
  let tempFile: string | null = null;

  afterEach(async () => {
    if (tempFile) {
      await unlink(tempFile).catch(() => {});
      tempFile = null;
    }
  });

  test("invokes the S3 client (via lib-storage Upload) and returns public URL on success", async () => {
    tempFile = join(tmpdir(), `storage-test-${Date.now()}.bin`);
    await writeFile(tempFile, Buffer.alloc(64, 1));

    const sendSpy = spyOn(S3Client.prototype, "send").mockResolvedValue({
      ETag: '"abc123"',
    } as never);

    try {
      const storage = createStorage(config);
      const url = await storage.putObject({
        key: "test.opus",
        filePath: tempFile,
        contentType: "audio/ogg",
      });

      expect(sendSpy).toHaveBeenCalled();
      expect(url).toBe(`${config.publicUrl}/test.opus`);
    } finally {
      sendSpy.mockRestore();
    }
  });

  test("propagates errors from the S3 client", async () => {
    tempFile = join(tmpdir(), `storage-test-${Date.now()}.bin`);
    await writeFile(tempFile, Buffer.alloc(64, 1));

    const sendSpy = spyOn(S3Client.prototype, "send").mockRejectedValue(
      new Error("network down") as never,
    );

    try {
      const storage = createStorage(config);
      let caught: unknown;
      try {
        await storage.putObject({
          key: "test.opus",
          filePath: tempFile,
          contentType: "audio/ogg",
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain("network down");
    } finally {
      sendSpy.mockRestore();
    }
  });
});
