import type { Redis } from "@ffmpeg-rest/redis";
import {
  CONVERT_RETRY_OPTIONS,
  type ConvertAudioJobPayload,
  JOB_RETENTION,
  QUEUE_CONVERT_AUDIO,
  QUEUE_WEBHOOK_DELIVERY,
  WEBHOOK_RETRY_OPTIONS,
  type WebhookDeliveryJobPayload,
} from "@ffmpeg-rest/shared";
import { Queue } from "bullmq";

export type Queues = {
  convertAudio: Queue<ConvertAudioJobPayload>;
  webhookDelivery: Queue<WebhookDeliveryJobPayload>;
  close(): Promise<void>;
};

export function createQueues(connection: Redis): Queues {
  const convertAudio = new Queue<ConvertAudioJobPayload>(QUEUE_CONVERT_AUDIO, {
    connection,
    defaultJobOptions: { ...JOB_RETENTION, ...CONVERT_RETRY_OPTIONS },
  });

  const webhookDelivery = new Queue<WebhookDeliveryJobPayload>(QUEUE_WEBHOOK_DELIVERY, {
    connection,
    defaultJobOptions: { ...JOB_RETENTION, ...WEBHOOK_RETRY_OPTIONS },
  });

  return {
    convertAudio,
    webhookDelivery,
    async close() {
      await Promise.all([convertAudio.close(), webhookDelivery.close()]);
    },
  };
}
