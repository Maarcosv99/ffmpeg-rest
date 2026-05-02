import { z } from "zod";

export const JobStatusSchema = z.enum(["queued", "active", "completed", "failed"]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobStateSchema = z.object({
  jobId: z.string(),
  status: JobStatusSchema,
  outputUrl: z.string().url().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type JobState = z.infer<typeof JobStateSchema>;
