import { spawn } from "node:child_process";

export class FFmpegError extends Error {
  constructor(
    message: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "FFmpegError";
  }
}

export type RunFFmpegArgs = {
  args: string[];
  timeoutMs: number;
};

export async function runFFmpeg({ args, timeoutMs }: RunFFmpegArgs): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

    const stderrChunks: Buffer[] = [];
    let stderrBytes = 0;
    const STDERR_LIMIT = 32_768;

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes < STDERR_LIMIT) {
        stderrChunks.push(chunk);
        stderrBytes += chunk.length;
      }
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new FFmpegError(`Failed to spawn ffmpeg: ${err.message}`, null, ""));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString("utf8").slice(-2048);
      if (signal === "SIGKILL") {
        reject(new FFmpegError(`ffmpeg timed out after ${timeoutMs}ms`, null, stderr));
        return;
      }
      if (code !== 0) {
        reject(new FFmpegError(`ffmpeg exited with code ${code}`, code, stderr));
        return;
      }
      resolve();
    });
  });
}
