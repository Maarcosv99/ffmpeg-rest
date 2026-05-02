import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FFmpegError, convertAudio } from "../src/index.ts";

const FIXTURE_PATH = resolve(import.meta.dir, "../../../tests/fixtures/sample.mp3");

function probeCodec(filePath: string): string {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=nokey=1:noprint_wrappers=1",
      filePath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "ffmpeg-test-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("convertAudio (real ffmpeg)", () => {
  test("converts MP3 to OPUS and the output is valid opus", async () => {
    const outputPath = join(workDir, "out.opus");
    await convertAudio({
      inputPath: FIXTURE_PATH,
      outputPath,
      format: "opus",
      timeoutMs: 10_000,
    });
    expect(probeCodec(outputPath)).toBe("opus");
  });

  test("converts MP3 to AAC", async () => {
    const outputPath = join(workDir, "out.aac");
    await convertAudio({
      inputPath: FIXTURE_PATH,
      outputPath,
      format: "aac",
      timeoutMs: 10_000,
    });
    expect(probeCodec(outputPath)).toBe("aac");
  });

  test("rejects with FFmpegError when input doesn't exist", async () => {
    const outputPath = join(workDir, "out.opus");
    let caught: unknown;
    try {
      await convertAudio({
        inputPath: join(workDir, "nonexistent.mp3"),
        outputPath,
        format: "opus",
        timeoutMs: 5_000,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(FFmpegError);
    expect((caught as FFmpegError).stderr.length).toBeGreaterThan(0);
  });

  test("respects custom bitrate", async () => {
    const outputPath = join(workDir, "out.opus");
    await convertAudio({
      inputPath: FIXTURE_PATH,
      outputPath,
      format: "opus",
      bitrate: "32k",
      timeoutMs: 10_000,
    });
    expect(probeCodec(outputPath)).toBe("opus");
  });
});
