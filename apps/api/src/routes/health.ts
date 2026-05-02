import type { Redis } from "@ffmpeg-rest/redis";
import { Elysia } from "elysia";

export function healthRoute(redis: Redis) {
  return new Elysia().get(
    "/health",
    async ({ set }) => {
      try {
        const pong = await redis.ping();
        if (pong !== "PONG") {
          set.status = 503;
          return { status: "unhealthy", redis: "unreachable" };
        }
        return { status: "ok", redis: "ok" };
      } catch (err) {
        set.status = 503;
        return {
          status: "unhealthy",
          redis: err instanceof Error ? err.message : "unknown",
        };
      }
    },
    {
      detail: {
        summary: "Healthcheck",
        description: "Returns 200 if Redis is reachable, 503 otherwise.",
      },
    },
  );
}
