import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertAudio } from "@ffmpeg-rest/ffmpeg";
import {
  type ConvertAudioJobPayload,
  type Env,
  QUEUE_WEBHOOK_DELIVERY,
  type WebhookDeliveryJobPayload,
} from "@ffmpeg-rest/shared";
import { CONTENT_TYPES, type Storage } from "@ffmpeg-rest/storage";
import type { Job, Queue } from "bullmq";
import { downloadToFile } from "../download.ts";

export type ConvertResult = { outputUrl: string; bytes: number };

export type ConvertProcessorDeps = {
  storage: Storage;
  webhookQueue: Queue<WebhookDeliveryJobPayload>;
  env: Env;
};

export function createConvertAudioProcessor(deps: ConvertProcessorDeps) {
  const { storage, webhookQueue, env } = deps;

  return async function process(job: Job<ConvertAudioJobPayload>): Promise<ConvertResult> {
    const { url, format, bitrate, webhook, webhookData, webhookSecret } = job.data;
    const jobId = job.id ?? `unknown-${Date.now()}`;

    const workDir = await mkdtemp(join(tmpdir(), "ffmpeg-rest-"));
    const inputPath = join(workDir, "input");
    const outputPath = join(workDir, `output.${format}`);

    try {
      await downloadToFile(url, inputPath, env.MAX_INPUT_BYTES);

      await convertAudio({
        inputPath,
        outputPath,
        format,
        bitrate,
        timeoutMs: env.FFMPEG_TIMEOUT_MS,
      });

      const key = `${jobId}.${format}`;
      const outputUrl = await storage.putObject({
        key,
        filePath: outputPath,
        contentType: CONTENT_TYPES[format] ?? "application/octet-stream",
      });

      if (webhook) {
        await webhookQueue.add(QUEUE_WEBHOOK_DELIVERY, {
          url: webhook,
          payload: {
            jobId,
            status: "completed",
            outputUrl,
            error: null,
            data: webhookData,
          },
          ...(webhookSecret !== undefined ? { secret: webhookSecret } : {}),
        });
      }

      return { outputUrl, bytes: 0 };
    } catch (err) {
      if (webhook) {
        await webhookQueue.add(QUEUE_WEBHOOK_DELIVERY, {
          url: webhook,
          payload: {
            jobId,
            status: "failed",
            outputUrl: null,
            error: err instanceof Error ? err.message : String(err),
            data: webhookData,
          },
          ...(webhookSecret !== undefined ? { secret: webhookSecret } : {}),
        });
      }
      throw err;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  };
}
