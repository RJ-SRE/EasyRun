import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [input, output] = process.argv.slice(2);
if (
  !input ||
  !output ||
  !output.toLowerCase().endsWith(".wav") ||
  resolve(input) === resolve(output)
) {
  console.error(
    "Usage: ./scripts/wr audio:convert <input audio> <new-output.wav>",
  );
  process.exit(1);
}
// Never overwrite a recording. Pass paths as separate arguments, not shell text.
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-n",
    "-i",
    resolve(input),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    resolve(output),
  ],
  { stdio: "inherit" },
);
if (result.error || result.status !== 0) {
  console.error(
    "Conversion failed; check input, FFmpeg, and whether output already exists.",
  );
  process.exit(1);
}
const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name,sample_rate,channels,bits_per_sample",
    "-of",
    "json",
    resolve(output),
  ],
  { encoding: "utf8" },
);
if (probe.error || probe.status !== 0) process.exit(1);
console.log(probe.stdout);
