// The inscription focus and field ledger reuse the web CSS. The title layout
// stays unchanged except its wordbook entry. 2x PNGs need no runtime DOM/fonts.
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
      #word-journal {position:absolute;inset:0;display:block;padding:0;background:#050c10b8}
      #word-journal > .word-ledger-page {position:absolute;left:180px;top:48px;width:600px;height:504px;max-height:none;padding:22px 24px 16px;display:block}
      #word-journal .word-ledger-head h2 {font:25px 'Songti SC',serif;letter-spacing:4px;margin:8px 0 12px}
      #word-journal .word-ledger-head .eyebrow {font-size:8px;letter-spacing:2px}
      #word-journal .fixed {position:absolute;margin:0;min-width:0}
      #word-journal button {font-size:10px;padding:6px 10px;color:#c4b287}
      #word-journal .word-legend {border:0;width:550px;font-size:10px}
      #word-journal .row-rule {position:absolute;width:266px;height:1px;background:#8d9c8f1c}
      #word-journal .footer-rule {position:absolute;left:204px;top:501px;width:550px;border-top:1px solid #ac936748}
      #word-journal .filter-shell {border:1px solid #b49b6b40;background:#101c1e}
      .ledger-input {position:relative;width:334px;height:30px;border:1px solid #b49b6b40;background:#101c1e;padding:7px 10px;color:#829187;font-size:11px}
      .ledger-input.focus {border-color:#c6ad7a;box-shadow:inset 0 -1px #c6ad7a55}
    </style><div id="capture"></div>`);
    const capture = page.locator("#capture");
    async function raster(name, w, h, markup) {
      await capture.evaluate(
        (el, { w, h, markup }) => {
          el.style.width = w + "px";
          el.style.height = h + "px";
          el.innerHTML = markup;
        },
        { w, h, markup },
      );
      art[name] = {
        w,
        h,
        data: (await capture.screenshot({ omitBackground: true })).toString(
          "base64",
        ),
      };
    }
    await raster(
      "ledger-entry",
      142,
      36,
      `<div class="word-actions" style="margin:0;height:36px"><button id="word-preview" style="width:142px;height:36px;padding:8px 10px"><span>随行词册</span><b>30 <i>↗</i></b></button></div>`,
    );
    await raster(
      "wordbook",
      960,
      600,
      `<section id="word-journal">
      <div class="word-ledger-page"><header class="word-ledger-head"><div><span class="eyebrow">FIELD LEDGER / XXX</span><h2>随行铭文</h2></div></header></div>
      <button class="fixed" style="left:724px;top:62px;width:30px;height:30px;border-color:transparent;font:25px Georgia;padding:0">×</button>
      <span class="fixed" style="left:204px;top:120px;font-size:11px;color:#d7c69f">本局已斩</span><span class="fixed" style="left:294px;top:120px;font-size:11px;color:#d7c69f">/ 30 · 待斩</span>
      <div class="word-legend fixed" style="left:204px;top:165px">○ 待遇见 <span>◐ 待复习</span> ◆ 已斩 <span>✦ 通关确认</span></div>
      <button class="filter-shell fixed" style="left:204px;top:190px;width:160px;height:30px;text-align:right">⌄</button>
      <button class="fixed" style="left:724px;top:190px;width:30px;height:30px;padding:0">×</button>
      <span class="fixed" style="left:204px;top:231px;font-size:10px;color:#93a399">当前匹配</span><span class="fixed" style="left:330px;top:231px;font-size:10px;color:#93a399">词 · 记录保留于本次运行</span>
      ${Array.from({ length: 8 }, (_, i) => `<i class="row-rule" style="left:${204 + (i % 2) * 282}px;top:${318 + Math.floor(i / 2) * 54}px"></i>`).join("")}
      <div class="footer-rule"></div><button class="fixed" style="left:204px;top:516px;width:180px;height:30px;border:0;text-align:left;padding-left:0">合上词册 · Esc / Tab</button>
      <button class="fixed" style="left:580px;top:516px;width:74px;height:30px">← 上页</button><button class="fixed" style="left:670px;top:516px;width:84px;height:30px">下页 →</button>
    </section>`,
    );
    await raster(
      "ledger-filter",
      160,
      90,
      `<div style="width:160px;height:90px;background:#101c1e;border:1px solid #b49b6b77">${["本局 30 词", "薄弱 / 宿敌词", "完整词库"].map((label) => `<div style="height:30px;padding:8px 10px;border-bottom:1px solid #b49b6b22;font-size:11px;color:#d9ccae">${label}</div>`).join("")}</div>`,
    );
    for (const [name, w, label] of [
      ["prev", 74, "← 上页"],
      ["next", 84, "下页 →"],
    ])
      for (let enabled = 0; enabled < 2; enabled++)
        await raster(
          `ledger-${name}${enabled}`,
          w,
          30,
          `<button style="width:${w}px;height:30px;padding:6px 8px;font-size:10px;background:#0e1719;color:${enabled ? "#c4b287" : "#53615d"};border-color:${enabled ? "#b49b6b40" : "#b49b6b18"}">${label}</button>`,
        );
    for (let i = 0; i < 4; i++)
      await raster(
        "ledger-search" + i,
        334,
        30,
        `<div class="ledger-input ${i % 2 ? "focus" : ""}">${i < 2 ? (i % 2 ? "输入英文查找 · Backspace 修改" : "搜索英文单词…") : ""}</div>`,
      );
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
      for (let n = 0; n < 27; n++)
        make("ledger-tally" + n, 50, 7, (c) => {
          for (let i = 0; i < 3; i++) {
            const state = Math.floor(n / Math.pow(3, i)) % 3;
            c.fillStyle = ["#87958c20", "#b47e57", "#cfbb83"][state];
            const x = i * 18;
            c.beginPath();
            c.moveTo(x + 2, 0);
            c.lineTo(x + 14, 0);
            c.lineTo(x + 12, 7);
            c.lineTo(x, 7);
            c.fill();
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
