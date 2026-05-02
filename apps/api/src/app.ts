import { openapi } from "@elysiajs/openapi";
import type { Redis } from "@ffmpeg-rest/redis";
import type { Env } from "@ffmpeg-rest/shared";
import { Elysia } from "elysia";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Queues } from "./queues.ts";
import { convertRoute } from "./routes/convert.ts";
import { healthRoute } from "./routes/health.ts";
import { jobsRoute } from "./routes/jobs.ts";

export type AppDeps = {
  redis: Redis;
  queues: Queues;
  env: Env;
};

export function createApp(deps: AppDeps) {
  return new Elysia()
    .use(
      openapi({
        documentation: {
          info: {
            title: "ffmpeg-rest",
            version: "0.1.0",
            description: "Audio conversion API powered by ffmpeg, BullMQ, and Elysia.",
          },
        },
        mapJsonSchema: {
          zod: zodToJsonSchema,
        },
      }),
    )
    .use(healthRoute(deps.redis))
    .use(convertRoute(deps.queues, deps.env))
    .use(jobsRoute(deps.queues));
}
