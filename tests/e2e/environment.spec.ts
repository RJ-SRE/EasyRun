import { expect, test, chromium } from "@playwright/test";
import { resolve } from "node:path";

test("画面渲染、键盘输入和页面脚本正常", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "环境检查",
  );
  await expect(page.locator("#render-status")).toContainText("动画已运行");
  const pixels = await page
    .locator("canvas")
    .evaluate((element: HTMLCanvasElement) => {
      const data = element
        .getContext("2d")!
        .getImageData(0, 0, element.width, element.height).data;
      return data.some((value) => value !== 0);
    });
  expect(pixels).toBe(true);
  await page.keyboard.press("Space");
  await expect(page.locator("#key-status")).toContainText("Jump");
  await page.keyboard.press("3");
  await expect(page.locator("#key-status")).toContainText("Sprint");
  expect(errors).toEqual([]);
});

test("不自动采音；拒绝麦克风后仍能使用键盘", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("用户拒绝权限", "NotAllowedError")),
    });
  });
  await page.goto("/");
  await expect(page.locator("#mic-status")).toContainText("尚未请求");
  await page
    .getByRole("button", { name: "开始麦克风检查", exact: true })
    .click();
  await expect(page.locator("#mic-status")).toContainText("麦克风不可用");
  await expect(page.locator("#mic-start")).toBeEnabled();
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("#key-status")).toContainText("Jump");
});

test("取消等待权限后，迟到的音频流也会被关闭", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        new Promise((resolveStream) => {
          Object.assign(window, {
            grantLateStream: () =>
              resolveStream({
                getTracks: () => [
                  {
                    stop: () => {
                      document.body.dataset.trackStopped = "true";
                    },
                  },
                ],
              }),
          });
        }),
    });
  });
  await page.goto("/");
  await page.locator("#mic-start").click();
  await expect(page.locator("#mic-status")).toContainText("等待");
  await page.locator("#mic-stop").click();
  await page.evaluate(() =>
    (
      window as typeof window & { grantLateStream: () => void }
    ).grantLateStream(),
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-track-stopped",
    "true",
  );
  await expect(page.locator("#mic-start")).toBeEnabled();
});

test("没有语音 API 时明确提示，并保留键盘", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(page.locator("#speech-start")).toBeDisabled();
  await expect(page.locator("#speech-capability")).toContainText(
    "没有识别 API",
  );
  await page.keyboard.press("2");
  await expect(page.locator("#key-status")).toContainText("Run");
});

test("窄屏检查页不出现横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("#mic-start")).toBeVisible();
});

test("Chromium 用合成音频走通采音和停止流程（非真人识别）", async ({
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Fake WAV capture is configured only for Chromium.",
  );
  const browser = await chromium.launch({
    channel: "chromium",
    args: [
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${resolve(".cache/audio/fixture-16k.wav")}`,
    ],
  });
  try {
    const context = await browser.newContext({ permissions: ["microphone"] });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173");
    await page.locator("#mic-start").click();
    await expect(page.locator("#mic-status")).toContainText("正在采集");
    await expect
      .poll(() =>
        page
          .locator("#mic-level")
          .evaluate((element: HTMLMeterElement) => element.value),
      )
      .toBeGreaterThan(0.01);
    await page.locator("#mic-stop").click();
    await expect(page.locator("#mic-status")).toContainText("已停止");
    await expect(page.locator("#mic-start")).toBeEnabled();
  } finally {
    await browser.close();
  }
});
