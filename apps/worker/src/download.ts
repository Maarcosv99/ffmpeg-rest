import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type DownloadResult = { bytes: number };

export class DownloadError extends Error {}

export async function downloadToFile(
  url: string,
  destPath: string,
  maxBytes: number,
): Promise<DownloadResult> {
  const response = await fetch(url, { redirect: "follow" });

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
  const fileStream = createWriteStream(destPath);

  const counter = new Readable({
    read() {},
  });

  const reader = response.body.getReader();
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        counter.push(null);
        return;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        counter.destroy(
          new DownloadError(
            `Input too large: exceeded limit of ${maxBytes} bytes during streaming`,
          ),
        );
        await reader.cancel();
        return;
      }
      counter.push(Buffer.from(value));
    }
  };

  const pumpPromise = pump();
  await pipeline(counter, fileStream);
  await pumpPromise;

  return { bytes };
}
