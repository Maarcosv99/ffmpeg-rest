import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  REDIS_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
  S3_REGION: z.string().default("auto"),
  S3_KEY_PREFIX: z.string().default(""),

  MAX_INPUT_BYTES: z.coerce.number().int().positive().default(100_000_000),

  JOB_CONCURRENCY: z.coerce.number().int().positive().default(2),
  WEBHOOK_CONCURRENCY: z.coerce.number().int().positive().default(10),

  ALLOW_HTTP_WEBHOOKS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  FFMPEG_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
