import { z } from "zod";

export const AudioFormatSchema = z.enum(["opus", "mp3", "aac", "wav", "flac"]);
export type AudioFormat = z.infer<typeof AudioFormatSchema>;

export const BitrateSchema = z.string().regex(/^\d+k$/, "Bitrate must be like '64k', '128k'");

export const ConvertRequestSchema = z.object({
  url: z.string().url(),
  format: AudioFormatSchema,
  bitrate: BitrateSchema.optional(),
  webhook: z.string().url().optional(),
  webhookData: z.unknown().optional(),
  webhookSecret: z.string().min(16).optional(),
});

export type ConvertRequest = z.infer<typeof ConvertRequestSchema>;

export const ConvertResponseSchema = z.object({
  jobId: z.string(),
  statusUrl: z.string(),
});

export type ConvertResponse = z.infer<typeof ConvertResponseSchema>;
