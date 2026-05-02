import { z } from "zod";
import { JobStatusSchema } from "./job.ts";

export const WebhookPayloadSchema = z.object({
  jobId: z.string(),
  status: JobStatusSchema,
  outputUrl: z.string().url().nullable(),
  error: z.string().nullable(),
  metadata: z.unknown().optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export const WebhookDeliveryJobSchema = z.object({
  url: z.string().url(),
  payload: WebhookPayloadSchema,
  secret: z.string().min(16).optional(),
});

export type WebhookDeliveryJob = z.infer<typeof WebhookDeliveryJobSchema>;
