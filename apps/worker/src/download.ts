import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export type DownloadResult = { bytes: number };

export class DownloadError extends Error {}

export type DownloadArgs = {
  url: string;
  destPath: string;
  maxBytes: number;
  timeoutMs: number;
};

export async function downloadToFile(args: DownloadArgs): Promise<DownloadResult> {
  const { url, destPath, maxBytes, timeoutMs } = args;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DownloadError(
        `Download failed with status ${response.status} ${response.statusText}`,
      );
    }

    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader) {
      const length = Number(lengthHeader);
      if (Number.isFinite(length) && length > maxBytes) {
        throw new DownloadError(`Input too large: ${length} bytes exceeds limit of ${maxBytes}`);
      }
    }

    if (!response.body) {
      throw new DownloadError("Response had no body");
    }

    await mkdir(dirname(destPath), { recursive: true });

    let bytes = 0;
    const sizeGuard = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) {
          callback(
            new DownloadError(
              `Input too large: exceeded limit of ${maxBytes} bytes during streaming`,
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });

    const source = Readable.fromWeb(
      response.body as unknown as import("stream/web").ReadableStream,
    );
    await pipeline(source, sizeGuard, createWriteStream(destPath));

    return { bytes };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new DownloadError(`Download timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
