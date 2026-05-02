import type { JobStatus } from "@ffmpeg-rest/shared";
import { Elysia, t } from "elysia";
import type { Queues } from "../queues.ts";

type BullState =
  | "completed"
  | "failed"
  | "active"
  | "delayed"
  | "waiting"
  | "waiting-children"
  | "paused"
  | "prioritized"
  | "unknown";

function mapStatus(state: BullState): JobStatus {
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  if (state === "active") return "active";
  return "queued";
}

export function jobsRoute(queues: Queues) {
  return new Elysia().get(
    "/jobs/:id",
    async ({ params, set }) => {
      const job = await queues.convertAudio.getJob(params.id);
      if (!job) {
        set.status = 404;
        return { error: "Job not found" };
      }

      const state = (await job.getState()) as BullState;
      const status = mapStatus(state);

      const result = job.returnvalue as { outputUrl?: string } | undefined;
      const outputUrl = result?.outputUrl ?? null;
      const error = job.failedReason ?? null;

      return {
        jobId: job.id ?? params.id,
        status,
        outputUrl,
        error,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Get the status of a conversion job",
      },
    },
  );
}
