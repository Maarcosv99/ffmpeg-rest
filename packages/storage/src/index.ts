import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { type StorageConfig, createStorageClient } from "./client.ts";

export { createStorageClient };
export type { StorageConfig };

export type Storage = {
  putObject(args: { key: string; filePath: string; contentType: string }): Promise<string>;
  getPublicUrl(key: string): string;
};

export function createStorage(config: StorageConfig): Storage {
  const client: S3Client = createStorageClient(config);

  return {
    async putObject({ key, filePath, contentType }) {
      const stats = await stat(filePath);
      const upload = new Upload({
        client,
        params: {
          Bucket: config.bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: contentType,
          ContentLength: stats.size,
        },
      });
      await upload.done();
      return getPublicUrl(config, key);
    },
    getPublicUrl(key) {
      return getPublicUrl(config, key);
    },
  };
}

function getPublicUrl(config: StorageConfig, key: string): string {
  const base = config.publicUrl.replace(/\/$/, "");
  return `${base}/${encodeURIComponent(key)}`;
}

export const CONTENT_TYPES: Record<string, string> = {
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
};
