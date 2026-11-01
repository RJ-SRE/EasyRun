import { WORDS } from "./public/common-words.js";
import { LEARNING_MILESTONES } from "./public/learning-milestones.js";
import {
  achievementBadgeSVG,
  achievementMountSVG,
  achievementPanelSVG,
  archiveMarkSVG,
  archiveNumber,
} from "./public/learning-art.js";
export async function buildNativeStudyArt(page) {
  const states = ["sealed", "active", "earned"];
  return page.evaluate(
    async ({
      achievements,
      bankSize,
      badgeSources,
      mountSources,
      panelSource,
      markSource,
      numbers,
    }) => {
      const art = {};
      let c;
      const body = '"PingFang SC","Microsoft YaHei",sans-serif';
      const serif = '"Songti SC","Noto Serif SC",serif';
      const load = async (source) => {
        const im = new Image();
        im.src =
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
        await im.decode();
        return im;
      };
      const [badges, mounts, panel, mark] = await Promise.all([
        Promise.all(badgeSources.map(load)),
        Promise.all(mountSources.map(load)),
        load(panelSource),
        load(markSource),
      ]);
      function paint(name, w, h, fn) {
        const el = document.createElement("canvas");
        el.width = w * 2;
        el.height = h * 2;
        c = el.getContext("2d");
        c.scale(2, 2);
        fn();
        art[name] = { w, h, data: el.toDataURL("image/png").split(",")[1] };
      }
      function text(
        s,
        x,
        y,
        size = 11,
        color = "#d4cbb4",
        family = body,
        align = "left",
      ) {
        c.font = `${size}px ${family}`;
        c.fillStyle = color;
        c.textAlign = align;
        c.fillText(s, x, y);
      }
      function line(x, y, xx, yy, color = "#bca97b55") {
        c.strokeStyle = color;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(xx, yy);
        c.stroke();
      }
      function wrap(s, x, y, width, size = 10.5, color = "#94a39a") {
        c.font = `${size}px ${body}`;
        let row = "",
          n = 0;
        for (const ch of Array.from(s)) {
          if (c.measureText(row + ch).width > width && row) {
            text(row.trim(), x, y + n * 15, size, color, body, "center");
            row = ch;
            n++;
          } else row += ch;
        }
        text(row.trim(), x, y + n * 15, size, color, body, "center");
      }
      function button(x, label, disabled = false) {
        c.strokeStyle = disabled ? "#a48f5e25" : "#a48f5e66";
        c.lineWidth = 0.6;
        c.strokeRect(x + 0.5, 500.5, 91, 30);
        text(
          label,
          x + 46,
          520,
          11,
          disabled ? "#758177" : "#d2be8f",
          serif,
          "center",
        );
      }
      for (let count = 0; count <= 24; count++)
        paint("study-top" + count, 960, 28, () => {
          const g = c.createLinearGradient(34, 0, 220, 0);
          g.addColorStop(0, "#0a1519b0");
          g.addColorStop(1, "#111f2155");
          c.fillStyle = g;
          c.fillRect(34, 1, 186, 25);
          c.drawImage(mark, 39, 2, 17, 21);
          text("铭文成就", 66, 18, 10, "#d1c4a3");
          line(132, 8, 132, 20, "#b49e693d");
          text(
            `${String(count).padStart(2, "0")} / 24`,
            147,
            18,
            11,
            "#e0d0a7",
          );
          line(34, 27, 220, 27);
          text("R U P T U R E  /  L E A R N I N G", 657, 18, 8, "#94a7a2");
        });
      paint("study-bottom", 960, 30, () => {
        text("本局", 36, 19, 10, "#a3b4ae");
        text("词库足迹", 490, 19, 10, "#a3b4ae");
        line(78, 16, 358, 16, "#7f948b77");
        line(565, 16, 777, 16, "#7f948b77");
        for (let i = 0; i <= 30; i++) {
          const x = 78 + (i * 280) / 30;
          line(x, 13, x, i % 5 === 0 ? 20 : 18, "#a6a58344");
        }
        text("/ " + bankSize, 859, 19, 10, "#95aaa4");
      });
      for (let i = 0; i <= 30; i++)
        paint("study-count" + i, 66, 26, () =>
          text(`${String(i).padStart(2, "0")} / 30`, 5, 18, 11, "#ead8ad"),
        );
      for (let i = 0; i < 10; i++)
        paint("study-digit" + i, 12, 26, () =>
          text(String(i), 2, 18, 11, "#e5d6b3"),
        );
      for (let i = 0; i <= 100; i++)
        for (const [kind, w] of [
          ["run", 280],
          ["bank", 212],
          ["card", 116],
        ])
          paint(`study-${kind}${i}`, w, 8, () => {
            if (kind === "card") {
              c.fillStyle = "#030d1055";
              c.fillRect(0, 2, w, 4);
              for (let n = 0; n <= 10; n++)
                line((n * w) / 10, 2, (n * w) / 10, 6, "#83907a35");
            }
            if (!i) return;
            const g = c.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, kind === "bank" ? "#487e80" : "#8c774c");
            g.addColorStop(1, kind === "bank" ? "#c1e6d4" : "#efdab0");
            c.fillStyle = g;
            c.fillRect(0, 3, (w * i) / 100, 2);
            c.fillStyle = "#f6e6bd";
            c.fillRect(Math.max(0, (w * i) / 100 - 1), 2, 1, 4);
          });
      for (const a of achievements) {
        paint("study-toast" + a.index, 300, 28, () => {
          const g = c.createLinearGradient(0, 0, 300, 0);
          g.addColorStop(0, "#142425d0");
          g.addColorStop(1, "#07121800");
          c.fillStyle = g;
          c.fillRect(0, 2, 300, 24);
          line(0, 4, 0, 24, "#c6ae73");
          c.drawImage(mark, 12, 4, 14, 20);
          text("新刻痕 · " + a.title, 36, 19, 11, "#ecd49c");
        });
        for (let state = 0; state < 3; state++)
          paint(`study-card${a.index}-${state}`, 152, 292, () => {
            c.drawImage(mounts[state], 0, 0, 152, 292);
            c.drawImage(badges[a.index * 3 + state], 23, 28, 106, 116);
            text(
              numbers[a.index],
              76,
              18,
              7,
              ["#6e7b75", "#b9a376", "#d0b780"][state],
              "Georgia,serif",
              "center",
            );
            text(
              a.title,
              76,
              183,
              17,
              ["#b7c1b6", "#d7cba9", "#f1e3bd"][state],
              serif,
              "center",
            );
            text(
              ["尚待刻印", "刻写之中", "已铭刻"][state],
              76,
              202,
              8,
              ["#748880", "#b9a376", "#d0b780"][state],
              body,
              "center",
            );
            wrap(a.rule, 76, 226, 122);
          });
      }
      for (let page = 0; page < 6; page++)
        paint("study-panel" + page, 960, 600, () => {
          c.drawImage(panel, 130, 76, 700, 468);
          text(
            "THE INSCRIPTION ARCHIVE",
            154,
            106,
            7.5,
            "#ad9b73",
            "Georgia,serif",
          );
          text("铭 文 成 就", 154, 138, 25, "#f0e5c8", serif);
          text("已铭刻", 721, 138, 8, "#9b9f90", body, "center");
          c.strokeStyle = "#bdaf8a";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(797, 96);
          c.lineTo(809, 108);
          c.moveTo(809, 96);
          c.lineTo(797, 108);
          c.stroke();
          button(608, "← 上页", page === 0);
          button(712, "下页 →", page === 5);
          for (let i = 0; i < 6; i++) {
            c.save();
            c.translate(480 + (i - 2.5) * 8, 531);
            c.rotate(Math.PI / 4);
            c.fillStyle = i === page ? "#dfc38c" : "#77847766";
            c.fillRect(-1.5, -1.5, 3, 3);
            c.restore();
          }
        });
      return art;
    },
    {
      achievements: LEARNING_MILESTONES,
      bankSize: WORDS.length,
      badgeSources: LEARNING_MILESTONES.flatMap((a) =>
        states.map((s) => achievementBadgeSVG(a, s)),
      ),
      mountSources: states.map(achievementMountSVG),
      panelSource: achievementPanelSVG(),
      markSource: archiveMarkSVG().replace(
        "<svg ",
        '<svg style="color:#c4ae7c" ',
      ),
      numbers: LEARNING_MILESTONES.map((a) => archiveNumber(a.index)),
    },
  );
}

export function installNativeStudyHUD(sprite) {
  const pin = (x, y) =>
    `setXYpos viewCenterX+${x}-480,viewCenterY+300-(${y}); setLayer Front`;
  sprite(
    "NativeStudyTop",
    Array.from({ length: 25 }, (_, i) => "study-top" + i),
    `func syncUI() {show; setCostume nativeStudyCount; ${pin(480, "nativeStudyTopY()")}}`,
    { interactive: true },
  );
  sprite(
    "NativeStudyBottom",
    ["study-bottom"],
    `func syncUI() {show; ${pin(480, "nativeStudyBottomY()")}}`,
    { interactive: false },
  );
  for (const [k, x] of [
    ["Run", 218, 280],
    ["Bank", 671, 212],
  ])
    sprite(
      "NativeStudy" + k,
      Array.from({ length: 101 }, (_, i) => `study-${k.toLowerCase()}${i}`),
      `func syncUI() {show; setCostume nativeStudy${k}Paint; ${pin(x, "nativeStudyBottomY()+1")}}`,
      { interactive: false },
    );
  sprite(
    "NativeStudyRunCount",
    Array.from({ length: 31 }, (_, i) => "study-count" + i),
    `func syncUI() {show; n:=nativeCompleted(); if wordMode==0 || practice!=0 {n=0}; setCostume n; ${pin(407, "nativeStudyBottomY()")}}`,
    { interactive: false },
  );
  for (let i = 0; i < 4; i++)
    sprite(
      "NativeStudyDigit" + i,
      Array.from({ length: 10 }, (_, i) => "study-digit" + i),
      `func syncUI() {show; n:=nativeLearnCorrectWords/${10 ** (3 - i)}%10; setCostume n; ${pin(811 + i * 12, "nativeStudyBottomY()")}}`,
      { interactive: false },
    );
  sprite(
    "NativeStudyToast",
    Array.from({ length: 24 }, (_, i) => "study-toast" + i),
    `func syncUI() {if nativeStudyToast>=0 && !nativeStudyOpen {show; setCostume nativeStudyToast; ${pin(480, "nativeStudyTopY()")}} else {hide}}`,
    { interactive: false },
  );
  sprite(
    "NativeStudyPanel",
    Array.from({ length: 6 }, (_, i) => "study-panel" + i),
    `func syncUI() {if nativeStudyOpen {show; setCostume nativeStudyPage; ${pin(480, 300)}} else {hide}}`,
    { interactive: true },
  );
  for (let slot = 0; slot < 4; slot++) {
    const x = 230 + slot * 166,
      y = 318;
    sprite(
      "NativeStudyCard" + slot,
      Array.from({ length: 6 }, (_, page) =>
        [0, 1, 2].map((n) => `study-card${page * 4 + slot}-${n}`),
      ).flat(),
      `func syncUI() {if nativeStudyOpen {show; i:=nativeStudyPage*4+${slot}; n:=nativeStudyPage*3; if nativeStudyUnlocked[i]>0 {n+=2} else if nativeStudyValues[nativeStudyMetric[i]]>0 {n++}; setCostume n; ${pin(x, y)}} else {hide}}`,
      { interactive: true },
    );
    sprite(
      "NativeStudyMeter" + slot,
      Array.from({ length: 101 }, (_, i) => "study-card" + i),
      `func syncUI() {if nativeStudyOpen {show; i:=nativeStudyPage*4+${slot}; n:=int(clamp(float64(nativeStudyValues[nativeStudyMetric[i]])/float64(nativeStudyGoals[i])*100,0,100)); if nativeStudyUnlocked[i]>0 {n=100}; setCostume n; ${pin(x, 452)}} else {hide}}`,
      { interactive: false },
    );
  }
}
