// The in-game inscription skin comes from the web CSS. Title/menu art is
// deliberately unchanged. Rasterized 2x PNGs need no DOM, fonts or network at runtime.
import { readFile } from "node:fs/promises";
const root = new URL("./", import.meta.url);
export async function buildNativeWordStyle(browser) {
  const css = (
    await Promise.all(
      ["belfry.css", "inscription.css"].map((name) =>
        readFile(new URL("public/" + name, root), "utf8"),
      ),
    )
  ).join("\n");
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const art = {};
  try {
    await page.setContent(`<style>${css}
      html,body {background:transparent!important;min-height:0!important;margin:0;overflow:hidden}
      *,*::before,*::after {animation:none!important;transition:none!important}
      #capture {position:relative;overflow:hidden}
      .word-focus-card {width:480px;height:100%;padding:0;display:block;animation:none;box-shadow:inset 0 0 0 3px #0c131680}
      .word-focus-head {position:absolute;left:83px;right:18px;top:13px}
      .word-focus-foot {position:absolute;left:83px;right:18px;bottom:9px;margin:0;padding-top:5px;min-height:18px}
      .word-focus-foot p {font-size:9px;margin:0;line-height:1.4;color:#a4ac96}
      .native-options {position:absolute;left:83px;top:74px;display:flex;gap:6px}
      .native-options div {width:116px;height:65px;border:1px solid #a58b5e55;border-radius:0 6px 0 0;background:linear-gradient(110deg,#b9a0690c,#122023)}
      .native-options kbd {display:block;width:15px;margin:5px 6px;border:0;border-bottom:1px solid #b79b6240;color:#bda572;font-size:9px}
      .seal-caption {position:absolute;left:24px;top:112px;width:32px;text-align:center}
      .paused-note {position:absolute;left:83px;top:48px;color:#eee3c9;font:22px 'Songti SC',serif;letter-spacing:2px}
      .paused-note small {display:block;color:#8e9c8f;font:11px sans-serif;letter-spacing:1px;margin-top:12px}
    </style><div id="capture"></div>`);
    const capture = page.locator("#capture");
    for (let mode = 0; mode < 3; mode++) {
      const h = mode === 1 ? 180 : 154;
      const markup = `<div class="word-focus-card"><header class="word-focus-head"><h2>${mode === 2 ? "铭文已暂停" : "以词解放刀锋"}</h2><span id="word-mode">${["誊写 / SPELL", "辨义 / MEANING", "时隙停驻"][mode]}</span></header><span class="seal-caption">时 隙</span>${mode === 1 ? `<div class="native-options">${[1, 2, 3].map((n) => `<div><kbd>${n}</kbd></div>`).join("")}</div>` : mode === 2 ? '<div class="paused-note">让思绪停一拍。<small>已保留输入 · 按 Esc 继续作答</small></div>' : ""}<footer class="word-focus-foot"><p>${mode === 0 ? "拼写完整 · Enter 确认 · Backspace 修改" : mode === 1 ? "按 1 / 2 / 3 选择正确词义" : "继续后恢复计时"}</p><small class="word-key-hint">Esc 暂停</small></footer></div>`;
      await capture.evaluate(
        (el, { h, markup }) => {
          el.style.width = "480px";
          el.style.height = h + "px";
          el.innerHTML = markup;
        },
        { h, markup },
      );
      art["question" + mode] = {
        w: 480,
        h,
        data: (await capture.screenshot({ omitBackground: true })).toString(
          "base64",
        ),
      };
    }
    const meters = await page.evaluate(() => {
      const images = {};
      const make = (name, w, h, draw) => {
        const c = document.createElement("canvas");
        c.width = w * 2;
        c.height = h * 2;
        const ctx = c.getContext("2d");
        ctx.scale(2, 2);
        draw(ctx);
        images[name] = { w, h, data: c.toDataURL("image/png").split(",")[1] };
      };
      for (let n = 0; n <= 60; n++)
        make("timer" + n, 56, 56, (c) => {
          c.strokeStyle = "#b69a6550";
          c.lineWidth = 0.7;
          c.setLineDash([14, 5, 8, 3]);
          c.beginPath();
          c.arc(28, 28, 25, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
          c.strokeStyle = "#b69a652c";
          c.lineWidth = 1.4;
          c.beginPath();
          c.arc(28, 28, 21, 0, Math.PI * 2);
          c.stroke();
          c.strokeStyle = n < 15 ? "#c58c68" : "#ccb582";
          c.beginPath();
          c.arc(
            28,
            28,
            21,
            -Math.PI / 2,
            -Math.PI / 2 + (Math.PI * 2 * n) / 60,
          );
          c.stroke();
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(28, 17);
          c.lineTo(32, 24);
          c.lineTo(39, 28);
          c.lineTo(32, 32);
          c.lineTo(28, 39);
          c.lineTo(24, 32);
          c.lineTo(17, 28);
          c.lineTo(24, 24);
          c.closePath();
          c.stroke();
          c.strokeStyle = "#b69a6570";
          c.beginPath();
          c.moveTo(28, 0);
          c.lineTo(28, 7);
          c.moveTo(28, 49);
          c.lineTo(28, 56);
          c.moveTo(0, 28);
          c.lineTo(7, 28);
          c.moveTo(49, 28);
          c.lineTo(56, 28);
          c.stroke();
        });
      for (let n = 0; n <= 22; n++)
        make("spelling-track" + n, 356, 28, (c) => {
          c.strokeStyle = "#9d8b5f66";
          c.lineWidth = 1;
          for (let i = 0; i < n; i++) {
            c.fillStyle = "#c4a56b0c";
            c.fillRect(i * 16, 0, 13, 26);
            c.beginPath();
            c.moveTo(i * 16, 26);
            c.lineTo(i * 16 + 13, 26);
            c.stroke();
          }
        });
      return images;
    });
    Object.assign(art, meters);
  } finally {
    await context.close();
  }
  return art;
}
