import type { ConvertRequest } from "./schemas/convert.ts";
import type { WebhookDeliveryJob } from "./schemas/webhook.ts";

export const QUEUE_CONVERT_AUDIO = "convert-audio" as const;
export const QUEUE_WEBHOOK_DELIVERY = "webhook-delivery" as const;

export type ConvertAudioJobPayload = ConvertRequest;
export type WebhookDeliveryJobPayload = WebhookDeliveryJob;

export const JOB_RETENTION = {
  removeOnComplete: { age: 86_400, count: 1000 },
  removeOnFail: { age: 604_800, count: 5000 },
} as const;

export const WEBHOOK_RETRY_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30_000 },
} as const;
