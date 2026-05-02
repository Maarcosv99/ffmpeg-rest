import { getSharedConnection } from "@ffmpeg-rest/redis";
import { loadEnv } from "@ffmpeg-rest/shared";
import { createApp } from "./app.ts";
import { createQueues } from "./queues.ts";

const env = loadEnv();
const redis = getSharedConnection(env.REDIS_URL);
const queues = createQueues(redis);

const app = createApp({ redis, queues, env });

app.listen(env.PORT, () => {
  console.log(`ffmpeg-rest api listening on :${env.PORT}`);
  console.log(`OpenAPI UI:  http://localhost:${env.PORT}/openapi`);
  console.log(`OpenAPI JSON: http://localhost:${env.PORT}/openapi/json`);
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  await queues.close();
  await redis.quit();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
