import type { AudioFormat } from "@ffmpeg-rest/shared";
import { runFFmpeg } from "./spawn.ts";

export { FFmpegError, runFFmpeg } from "./spawn.ts";

const CODEC_BY_FORMAT: Record<AudioFormat, string> = {
  opus: "libopus",
  mp3: "libmp3lame",
  aac: "aac",
  wav: "pcm_s16le",
  flac: "flac",
};

const DEFAULT_BITRATE: Record<AudioFormat, string | null> = {
  opus: "64k",
  mp3: "128k",
  aac: "128k",
  wav: null,
  flac: null,
};

export type ConvertAudioArgs = {
  inputPath: string;
  outputPath: string;
  format: AudioFormat;
  bitrate?: string;
  timeoutMs: number;
};

export async function convertAudio(args: ConvertAudioArgs): Promise<void> {
  const { inputPath, outputPath, format, bitrate, timeoutMs } = args;
  const codec = CODEC_BY_FORMAT[format];
  const effectiveBitrate = bitrate ?? DEFAULT_BITRATE[format];

  const ffmpegArgs: string[] = [
    "-protocol_whitelist",
    "file,crypto,http,https,tcp,tls",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    codec,
  ];

  if (effectiveBitrate) {
    ffmpegArgs.push("-b:a", effectiveBitrate);
  }

  ffmpegArgs.push(outputPath);

  await runFFmpeg({ args: ffmpegArgs, timeoutMs });
}
