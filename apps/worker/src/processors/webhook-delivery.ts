import {
  type Env,
  type ValidationResult,
  type WebhookDeliveryJobPayload,
  signPayload,
  validateWebhookUrlAsync,
} from "@ffmpeg-rest/shared";
import type { Job } from "bullmq";

export type ValidateWebhookFn = (
  url: string,
  options: { allowHttp: boolean },
) => Promise<ValidationResult>;

export type WebhookProcessorDeps = {
  env: Env;
  validate?: ValidateWebhookFn;
};

export function createWebhookDeliveryProcessor(deps: WebhookProcessorDeps) {
  const { env } = deps;
  const validate: ValidateWebhookFn = deps.validate ?? validateWebhookUrlAsync;

  return async function process(job: Job<WebhookDeliveryJobPayload>): Promise<{ status: number }> {
    const { url, payload, secret } = job.data;

    const validation = await validate(url, {
      allowHttp: env.ALLOW_HTTP_WEBHOOKS,
    });
    if (!validation.ok) {
      throw new Error(`Webhook URL rejected: ${validation.reason}`);
    }

    const rawBody = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-job-id": payload.jobId,
    };
    if (secret) {
      headers["x-signature"] = signPayload(rawBody, secret);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: rawBody,
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        throw new Error(`Webhook returned redirect ${response.status} — refusing to follow`);
      }

      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}`);
      }

      return { status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  };
}
