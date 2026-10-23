import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync(".cache/audio", { recursive: true });
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    ".cache/audio/fixture-16k.wav",
  ],
  { stdio: "inherit" },
);
if (result.error || result.status !== 0) {
  console.error(
    "FFmpeg unavailable or failed. On this Mac: brew install ffmpeg",
  );
  process.exit(1);
}
console.log(
  "Generated synthetic tone: .cache/audio/fixture-16k.wav (not speech).",
);
