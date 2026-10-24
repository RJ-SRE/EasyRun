import { chromium } from "@playwright/test";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const label = process.argv[2] || "motion";
const clean = process.argv.includes("--clean");
const dir = new URL(`test-results/${label}/`, import.meta.url);
await mkdir(dir, { recursive: true });
const b = await chromium.launch({ headless: true, channel: "chromium" });
const c = await b.newContext({
  viewport: { width: 1280, height: 850 },
  ...(!clean && {
    recordVideo: {
      dir: fileURLToPath(dir),
      size: { width: 1280, height: 850 },
    },
  }),
});
const p = await c.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await p.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
await p.waitForFunction(
  () => latestState?.phase === 0 || runtimeErrors.length,
  {},
  { timeout: 30000 },
);
await p.evaluate(() => {
  window.motionSamples = [];
  window.frameTimes = [];
  let before = performance.now();
  function sample(now) {
    if (latestState?.phase === 1) {
      frameTimes.push(now - before);
      motionSamples.push({ ...latestState, wall: now });
    }
    before = now;
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
});
if (clean)
  await p.evaluate(() => {
    const canvas = document
      .querySelector("iframe")
      .contentDocument.querySelector("#game-canvas");
    window.captureChunks = [];
    window.motionRecorder = new MediaRecorder(canvas.captureStream(60), {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 4500000,
    });
    motionRecorder.ondataavailable = (e) => captureChunks.push(e.data);
    motionRecorder.start();
  });
await p.locator("#play").click();
const at = async (x) => {
  await p.waitForFunction(
    (x) => latestState.x >= x || latestState.phase !== 1,
    x,
    { timeout: 12000 },
  );
  if ((await p.evaluate(() => latestState.phase)) !== 1)
    throw Error(`Failed before ${x}`);
};
const tap = async (key) => {
  await p.keyboard.press(key, { delay: 65 });
  await p.waitForTimeout(45);
};
try {
  await p.keyboard.down("d");
  await at(350);
  if (!clean)
    await p
      .locator(".viewport")
      .screenshot({ path: fileURLToPath(new URL("run.png", dir)) });
  await at(650);
  await tap("e");
  await at(900);
  await tap("e");
  await p.waitForTimeout(80);
  if (!clean)
    await p
      .locator(".viewport")
      .screenshot({ path: fileURLToPath(new URL("dash.png", dir)) });
  await at(1500);
  if (!clean)
    await p
      .locator(".viewport")
      .screenshot({ path: fileURLToPath(new URL("land.png", dir)) });
  await at(1870);
  await tap("e");
  await at(1970);
  await tap("e");
  await p.waitForFunction(
    () => latestState.phase !== 1,
    {},
    { timeout: 10000 },
  );
  await p.keyboard.up("d");
  if ((await p.evaluate(() => latestState.phase)) !== 2)
    throw Error("The recorded route did not finish.");
  await p.waitForTimeout(400);
} catch (e) {
  errors.push(e.stack);
}
const data = await p.evaluate(() => ({
  samples: motionSamples,
  intervals: frameTimes,
  state: latestState,
  events: runEvents,
  errors: runtimeErrors,
}));
const sorted = data.intervals.slice().sort((a, b) => a - b);
data.summary = {
  rAFMedianMs: sorted[Math.floor(sorted.length * 0.5)],
  rAFP95Ms: sorted[Math.floor(sorted.length * 0.95)],
  over33ms: sorted.filter((t) => t > 33.4).length,
  frames: sorted.length,
};
data.errors.push(...errors);
if (data.errors.length) process.exitCode = 1;
await writeFile(new URL("metrics.json", dir), JSON.stringify(data, null, 2));
if (clean) {
  const base64 = await p.evaluate(
    () =>
      new Promise((resolve) => {
        motionRecorder.onstop = () => {
          motionRecorder.stream.getTracks().forEach((t) => t.stop());
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(new Blob(captureChunks, { type: "video/webm" }));
        };
        motionRecorder.stop();
      }),
  );
  await writeFile(new URL("play.webm", dir), Buffer.from(base64, "base64"));
  await c.close();
} else {
  const video = p.video();
  await c.close();
  await rename(await video.path(), fileURLToPath(new URL("play.webm", dir)));
}
await b.close();
console.log(
  JSON.stringify({
    label,
    ...data.summary,
    state: data.state,
    errors: data.errors,
  }),
);
