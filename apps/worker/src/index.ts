import { createConnection } from "@ffmpeg-rest/redis";
import {
  type ConvertAudioJobPayload,
  QUEUE_CONVERT_AUDIO,
  QUEUE_WEBHOOK_DELIVERY,
  type WebhookDeliveryJobPayload,
  loadEnv,
} from "@ffmpeg-rest/shared";
import { createStorage } from "@ffmpeg-rest/storage";
import { Queue, Worker } from "bullmq";
import { createConvertAudioProcessor } from "./processors/convert-audio.ts";
import { createWebhookDeliveryProcessor } from "./processors/webhook-delivery.ts";

const env = loadEnv();
const connection = createConnection(env.REDIS_URL, "worker");

const storage = createStorage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
  bucket: env.S3_BUCKET,
  publicUrl: env.S3_PUBLIC_URL,
});

const webhookQueue = new Queue<WebhookDeliveryJobPayload>(QUEUE_WEBHOOK_DELIVERY, { connection });

const convertWorker = new Worker<ConvertAudioJobPayload>(
  QUEUE_CONVERT_AUDIO,
  createConvertAudioProcessor({ storage, webhookQueue, env }),
  { connection, concurrency: env.JOB_CONCURRENCY },
);

const webhookWorker = new Worker<WebhookDeliveryJobPayload>(
  QUEUE_WEBHOOK_DELIVERY,
  createWebhookDeliveryProcessor({ env }),
  { connection, concurrency: env.WEBHOOK_CONCURRENCY },
);

for (const w of [convertWorker, webhookWorker]) {
  w.on("failed", (job, err) => {
    console.error(`[${w.name}] job ${job?.id} failed:`, err.message);
  });
  w.on("completed", (job) => {
    console.log(`[${w.name}] job ${job.id} completed`);
  });
}

console.log(
  `worker running — convert(concurrency=${env.JOB_CONCURRENCY}) webhook(concurrency=${env.WEBHOOK_CONCURRENCY})`,
);

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  await Promise.all([convertWorker.close(), webhookWorker.close()]);
  await webhookQueue.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
