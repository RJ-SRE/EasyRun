/* global document */
// Static labels use four original sprites; dynamic text reuses the glyph pool.
export async function buildNativeCombatArt(page) {
  return page.evaluate(() => {
    const images = {};
    let c;
    const ivory = "#eee6d0",
      gold = "#c7b180",
      dim = "#a7b6b3";
    const text = (s, x, y, size = 11, color = ivory) => {
      c.font = `${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      c.fillStyle = color;
      c.fillText(s, x, y);
    };
    const line = (x, y, w, color = "#c7b18055") => {
      c.fillStyle = color;
      c.fillRect(x, y, w, 1);
    };
    const draw = (key, w, h, paint) => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      c = canvas.getContext("2d");
      c.scale(2, 2);
      paint();
      images[key] = { w, h, data: canvas.toDataURL("image/png").split(",")[1] };
    };
    for (let e = 0; e <= 2; e++)
      for (let hit = 0; hit <= 4; hit++) {
        draw(`combat-embers-${e * 5 + hit}`, 158, 24, () => {
          text("余烬", 0, 15, 10, dim);
          for (let i = 0; i < 2; i++) {
            c.beginPath();
            c.moveTo(40 + i * 16, 5);
            c.lineTo(46 + i * 16, 11);
            c.lineTo(40 + i * 16, 17);
            c.lineTo(34 + i * 16, 11);
            c.closePath();
            c.strokeStyle = i < e ? gold : "#81918c";
            c.lineWidth = 1;
            c.stroke();
            if (i < e) {
              c.fillStyle = gold;
              c.fill();
            }
          }
          for (let i = 0; i < 4; i++)
            line(78 + i * 12, 12, 8, e === 2 || i < hit ? gold : "#788b8a55");
          text(e === 2 ? "满" : `${hit}/4`, 128, 15, 9, dim);
        });
      }
    const forms = ["守铠", "断锋", "缚心"];
    const moves = [
      "衡刃横断",
      "穿阶推进",
      "断阶劈落",
      "折返双割",
      "掠身回锋",
      "跃刃封空",
      "缚刃回收",
      "支地折跃",
      "葬刃三决",
    ];
    const states = [
      "观察站位",
      "形态转化",
      "收势 · 可反击",
      "换位 · 留意落点",
      ...moves.flatMap((s) => [
        s + " · 蓄势",
        s + " · 方向锁定",
        s + " · 出招",
      ]),
      "再蓄势",
      "链刃插地 · J 可弹开",
      "链刃回收",
      "插刃 · U/L/P 连续命中",
      "回流 · 答题时仍继续",
      "断印 1/2 · U/L/P 追击",
      "回流已断",
      "刃势回收",
      "重整姿态",
    ];
    forms.forEach((form, f) =>
      states.forEach((state, s) =>
        draw(`combat-boss-${f * 40 + s}`, 352, 56, () => {
          const g = c.createLinearGradient(0, 0, 0, 56);
          g.addColorStop(0, "#071116b8");
          g.addColorStop(1, "#07111655");
          c.fillStyle = g;
          c.fillRect(0, 0, 352, 56);
          text("守心者 · " + form, 16, 18, 12, [gold, "#c9c2ac", "#dedfd5"][f]);
          text(
            state,
            16,
            37,
            11,
            s === 2
              ? "#add2c2"
              : s >= 4 && (s - 4) % 3 === 2
                ? "#e4a18a"
                : ivory,
          );
          line(16, 49, 320, "#86928d55");
          line(16 + 320 / 3, 47, 1, ivory);
          line(16 + 640 / 3, 47, 1, ivory);
        }),
      ),
    );
    for (let palette = 0; palette < 4; palette++)
      for (let i = 0; i <= 100; i++)
        draw(`combat-boss-fill-${palette * 101 + i}`, 320, 3, () => {
          c.fillStyle = [gold, "#c6b795", "#d6dfd8", "#b6e4b1"][palette];
          c.fillRect(0, 0, (320 * i) / 100, 3);
        });
    for (let i = 0; i <= 100; i++)
      draw(`combat-mend-${i}`, 320, 3, () => {
        c.fillStyle = "#395b5444";
        c.fillRect(0, 0, 320, 3);
        c.fillStyle = "#a7ddc0";
        c.fillRect(0, 0, (320 * i) / 100, 3);
      });
    const notices = [
      "",
      "封脉 · 暂时无法行动",
      "缚索牵制 · J 断链",
      "缚索牵制 · J 断链 / F 铭文脱困",
      "贯夜 · 自由瞄准",
      "贯夜 · 已锁定目标",
      "断潮 · 满蓄可破架",
      "空中追击已用尽 · 落地或挂钩恢复",
      "空中追击 · 剩余 1 次",
      "护架挡刀 · 绕背或蓄刀破架",
      "护架已破 · 追击窗口",
      "牵线已断 · 掩护解除",
      "先落地，再回息",
      "生命已满",
      "余烬不足 · 命中敌人恢复",
      "检查点已点亮",
      "回声已收集 · 余烬充满",
      "回流已断 · 追击窗口",
      "守心者回流 · 连续 U/L/P 命中打断",
    ];
    notices.forEach((s, i) =>
      draw(`combat-notice-${i}`, 398, 26, () => {
        if (!i) return;
        const g = c.createLinearGradient(0, 0, 398, 0);
        g.addColorStop(0, "#071116d9");
        g.addColorStop(1, "#07111600");
        c.fillStyle = g;
        c.fillRect(0, 0, 398, 26);
        c.fillStyle = i === 1 || i === 2 || i === 3 ? "#ce8f7c" : gold;
        c.fillRect(0, 6, 2, 14);
        text(s, 10, 18, 11);
      }),
    );
    return images;
  });
}

export function installNativeCombatHUD(sprite, pin, active) {
  sprite(
    "NativeEmbers",
    Array.from({ length: 15 }, (_, i) => `combat-embers-${i}`),
    `func syncUI() {if ${active} {show; setCostume nativeCombatEmbers; ${pin(115, 80)}} else {hide}}`,
  );
  sprite(
    "NativeBossPanel",
    Array.from({ length: 120 }, (_, i) => `combat-boss-${i}`),
    `func syncUI() {if nativeCombatBoss && (phase==1 || phase==5) && !nativeHelp && !nativePreview {show; setCostume nativeCombatBossLabel; ${pin(480, 56)}; if phase==5 {${pin(760, 202)}}} else {hide}}`,
  );
  sprite(
    "NativeBossFill",
    Array.from({ length: 404 }, (_, i) => `combat-boss-fill-${i}`),
    `func syncUI() {if nativeCombatBoss && (phase==1 || phase==5) && !nativeHelp && !nativePreview {show; palette:=bossStage; if enemyState[keeperIndex]==7 {palette=3}; setCostume palette*101+nativeCombatBossFill; ${pin(480, 78)}; if phase==5 {${pin(760, 224)}}} else {hide}}`,
  );
  sprite(
    "NativeBossMendGauge",
    Array.from({ length: 101 }, (_, i) => `combat-mend-${i}`),
    `func syncUI() {if nativeCombatBoss && enemyState[keeperIndex]==7 && !nativeHelp && !nativePreview {show; setCostume int(clamp((1-bossMendAge/bossMendDuration)*100,0,100)); ${pin(480, 94)}; if phase==5 {${pin(760, 240)}}} else {hide}}`,
  );
  sprite(
    "NativeCombatNotice",
    Array.from({ length: 19 }, (_, i) => `combat-notice-${i}`),
    `func syncUI() {if phase==1 && !nativeHelp && !nativePreview && nativeCombatNotice>0 {show; setCostume nativeCombatNotice; ${pin(235, 526)}} else {hide}}`,
  );
}
