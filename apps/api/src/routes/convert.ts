import {
  ConvertRequestSchema,
  ConvertResponseSchema,
  type Env,
  validateWebhookUrlSync,
} from "@ffmpeg-rest/shared";
import { Elysia } from "elysia";
import type { Queues } from "../queues.ts";

export function convertRoute(queues: Queues, env: Env) {
  return new Elysia().post(
    "/convert",
    async ({ body, set }) => {
      if (body.webhook) {
        const validation = validateWebhookUrlSync(body.webhook, {
          allowHttp: env.ALLOW_HTTP_WEBHOOKS,
        });
        if (!validation.ok) {
          set.status = 400;
          return { error: `Invalid webhook URL: ${validation.reason}` };
        }
      }

      const job = await queues.convertAudio.add("convert", body);
      const jobId = job.id ?? "";

      const response = ConvertResponseSchema.parse({
        jobId,
        statusUrl: `/jobs/${jobId}`,
      });
      return response;
    },
    {
      body: ConvertRequestSchema,
      detail: {
        summary: "Enqueue an audio conversion job",
        description:
          "Validates input, optionally validates webhook URL against SSRF blocklist, enqueues to BullMQ, returns jobId immediately.",
      },
    },
  );
}
