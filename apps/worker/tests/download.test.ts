import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { stat, unlink } from "node:fs/promises";
import { type Server, createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DownloadError, downloadToFile } from "../src/download.ts";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/ok") {
      const body = Buffer.alloc(1024, 7);
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": String(body.byteLength),
      });
      res.end(body);
      return;
    }

    if (url === "/chunked-large") {
      // No content-length: server uses chunked encoding. Early check is skipped,
      // size guard must enforce the limit during streaming.
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(Buffer.alloc(10_000, 7));
      return;
    }

    if (url === "/oversized-declared") {
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": "9999999",
      });
      res.end(Buffer.alloc(10, 7));
      return;
    }

    if (url === "/slow") {
      res.writeHead(200, {
        "content-type": "application/octet-stream",
      });
      res.write(Buffer.alloc(1, 0));
    }

    if (url === "/notfound") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address && typeof address === "object") port = address.port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

let tempFile: string | null = null;

afterEach(async () => {
  if (tempFile) {
    await unlink(tempFile).catch(() => {});
    tempFile = null;
  }
});

function makeTempPath(): string {
  tempFile = join(tmpdir(), `download-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return tempFile;
}

describe("downloadToFile", () => {
  test("happy path: downloads /ok and writes the right number of bytes", async () => {
    const dest = makeTempPath();
    const result = await downloadToFile({
      url: `http://127.0.0.1:${port}/ok`,
      destPath: dest,
      maxBytes: 10_000,
      timeoutMs: 5_000,
    });

    expect(result.bytes).toBe(1024);
    const stats = await stat(dest);
    expect(stats.size).toBe(1024);
  });

  test("rejects early via Content-Length when the declared size exceeds maxBytes", async () => {
    const dest = makeTempPath();
    let caught: unknown;
    try {
      await downloadToFile({
        url: `http://127.0.0.1:${port}/oversized-declared`,
        destPath: dest,
        maxBytes: 100,
        timeoutMs: 5_000,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DownloadError);
    expect((caught as DownloadError).message).toMatch(/exceeds limit of 100/);
  });

  test("rejects when body bytes exceed maxBytes (regardless of Content-Length presence)", async () => {
    const dest = makeTempPath();
    let caught: unknown;
    try {
      await downloadToFile({
        url: `http://127.0.0.1:${port}/chunked-large`,
        destPath: dest,
        maxBytes: 500,
        timeoutMs: 5_000,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DownloadError);
    // Could be caught by either the Content-Length pre-check or the streaming guard
    expect((caught as DownloadError).message).toMatch(/limit of 500/);
  });

  test("aborts when server hangs longer than timeoutMs", async () => {
    const dest = makeTempPath();
    const start = Date.now();
    let caught: unknown;
    try {
      await downloadToFile({
        url: `http://127.0.0.1:${port}/slow`,
        destPath: dest,
        maxBytes: 10_000,
        timeoutMs: 200,
      });
    } catch (e) {
      caught = e;
    }
    const elapsed = Date.now() - start;
    expect(caught).toBeInstanceOf(DownloadError);
    expect((caught as DownloadError).message).toMatch(/timed out after 200ms/);
    expect(elapsed).toBeLessThan(2_000);
  });

  test("rejects with DownloadError on HTTP 404", async () => {
    const dest = makeTempPath();
    let caught: unknown;
    try {
      await downloadToFile({
        url: `http://127.0.0.1:${port}/notfound`,
        destPath: dest,
        maxBytes: 10_000,
        timeoutMs: 5_000,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DownloadError);
    expect((caught as DownloadError).message).toMatch(/status 404/);
  });
});
