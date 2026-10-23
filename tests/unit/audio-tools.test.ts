import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("本地音频工具链", () => {
  it("生成能被 FFprobe 读取的 1 秒、16 kHz、单声道、16-bit PCM WAV", () => {
    const output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        ".cache/audio/fixture-16k.wav",
      ],
      { encoding: "utf8" },
    );
    const info = JSON.parse(output);
    expect(info.streams).toHaveLength(1);
    expect(info.streams[0]).toMatchObject({
      codec_name: "pcm_s16le",
      channels: 1,
      sample_rate: "16000",
      bits_per_sample: 16,
    });
    expect(Number(info.format.duration)).toBeCloseTo(1, 2);
    const bytes = readFileSync(".cache/audio/fixture-16k.wav");
    expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString()).toBe("WAVE");
    expect(bytes.length).toBeGreaterThan(32_000);
  });
});
