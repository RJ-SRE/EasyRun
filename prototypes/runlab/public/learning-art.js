// Shared vector artwork for the DOM archive and pre-rendered native costumes.
// No frame loop, canvas animation, network texture or new game sprite is needed.
export const ARCHIVE_COLORS = {
  ink: "#0c151a",
  iron: "#536464",
  brass: "#b49b69",
  ivory: "#eee2bf",
};
const roman = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
  "XXIV",
];
export const archiveNumber = (index) => roman[index] || String(index + 1);
export const archiveState = (unlocked, value) =>
  unlocked ? "earned" : value > 0 ? "active" : "sealed";
export const archiveStatus = (state) =>
  ({ sealed: "尚待刻印", active: "刻写之中", earned: "已铭刻" })[state];
const palette = (state) =>
  ({
    sealed: {
      edge: "#536465",
      high: "#85918a",
      shade: "#263738",
      face: "#253332",
      light: "#768480",
    },
    active: {
      edge: "#a38b5d",
      high: "#d2c59b",
      shade: "#3b392c",
      face: "#454334",
      light: "#d2bd87",
    },
    earned: {
      edge: "#c7ad75",
      high: "#f4e5ba",
      shade: "#57503a",
      face: "#756448",
      light: "#f5e3b5",
    },
  })[state];
// Etched objects replace the old small dashboard symbols. The catalogue and
// saved achievement IDs stay untouched; both renderers consume these paths.
const archiveGlyphs = [
  "M3 9Q9 5 16 9Q23 5 29 9V26Q23 23 16 27Q9 23 3 26ZM16 9V27M5 10v13M27 10v13M7 12q3-1 6 0m6 0q3-1 6 0M7 16q3-1 6 0m6 0q3-1 6 0M7 20q3-1 6 0m6 0q3-1 6 0M1 27l2 2q7-3 13 0 6-3 13 0l2-2",
  "M5 28 22 6Q27 2 29 6Q30 13 20 19L8 25ZM8 25 23 9M14 18l-1-6m4 3-1-6m3 3 0-5M13 21h6m-3-4h8M3 29h15M5 31h11",
  "M2 16Q16 2 30 16Q16 30 2 16ZM7 12q9-9 18 0M16 10a6 6 0 1 0 .1 0M16 13a3 3 0 1 0 .1 0M16 3V1M16 29v2M4 7 2 5m26 2 2-2",
  "M15 7 9 3 3 8v15l6 6 6-4M17 7l6-4 6 5v15l-6 6-6-4M15 7v18m2-18v18M6 10l3-2 3 2v12l-3 2-3-2Zm14 0 3-2 3 2v12l-3 2-3-2ZM12 14h8m-8 5h8",
  "M9 26 7 20l5-11 10-5 4 9-4 14-7 2ZM12 9l6 5-5 5 5 6M4 12q-3 9 4 15m-5-6 1 6 6-1M23 6q6 4 6 11m-2-5 2 5 3-4M17 4l1-3",
  "M23 3A14 14 0 1 0 29 24A13 13 0 0 1 23 3ZM8 19q5 5 10 0m-8 3-1 2m7-2 1 2M26 8v6m-3-3h6M23 18l2 2-2 2-2-2Z",
  "M6 3h20M5 5h22M5 27h22M6 29h20M8 5v5l8 8 8-8V5M8 27v-5l8-8 8 8v5M11 8h10M11 24l5-4 5 4ZM15 10h2M16 17v2M4 3v2m24-2v2M4 27v2m24-2v2",
  "M16 7a9 9 0 1 0 .1 0M16 1v4m0 22v4M1 16h4m22 0h4M5 5l3 3m16 16 3 3M5 27l3-3M24 8l3-3M16 10v7l5 3M7 16h2m14 0h2M16 23v2M12 4l1 2m7-2-1 2",
  "M2 23Q6 12 11 16T21 16Q25 11 30 9M2 26Q7 15 11 19T21 19Q26 14 30 12M7 10l2-4 2 4-2 4ZM16 6l2-4 2 4-2 4ZM24 25l2-4 2 4-2 4Z",
];
export function archiveMarkSVG() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M4 22V10Q4 6 12 2q8 4 8 8v12l-8 4Z" stroke="currentColor"/><path d="M7 20V11q0-3 5-6 5 3 5 6v9l-5 3Z" stroke="currentColor" opacity=".5"/><path d="M8 11h3v8H8zm5 0h3v8h-3M12 10v12" stroke="currentColor" stroke-width=".7"/></svg>';
}
export function achievementBadgeSVG(a, state = "sealed") {
  const p = palette(state),
    rank = a.index - [0, 6, 9, 12, 15, 17, 19, 21, 23][a.metric] + 1,
    uid = `seal-${a.id}-${state}`;
  let rivets = "";
  for (let i = 0; i < Math.min(rank, 6); i++) {
    const x = 64 + (i - (Math.min(rank, 6) - 1) / 2) * 10;
    rivets += `<path d="M${x} 106l2 3-2 3-2-3Z" fill="${p.light}" opacity=".8"/>`;
  }
  const glyph = archiveGlyphs[a.metric] || a.icon;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 140" fill="none">
  <defs><linearGradient id="${uid}-metal" x1="16" y1="12" x2="107" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="${p.high}"/><stop offset=".28" stop-color="${p.edge}"/><stop offset=".53" stop-color="${p.shade}"/><stop offset=".73" stop-color="${p.high}"/><stop offset="1" stop-color="${p.edge}"/></linearGradient><linearGradient id="${uid}-recess" x2="0" y2="1"><stop stop-color="#071215"/><stop offset=".7" stop-color="${p.face}"/><stop offset="1" stop-color="#152221"/></linearGradient></defs>
  <path d="M64 6 90 24 104 45v44l-12 20-28 21-28-21-12-20V45l14-21Z" fill="#060d10" opacity=".6" transform="translate(0 2)"/>
  <path d="M64 4 92 23 108 45v45l-13 22-31 23-31-23-13-22V45l16-22Z" fill="url(#${uid}-metal)"/>
  <path d="M64 10 88 27 102 47v41l-12 19-26 20-26-20-12-19V47l14-20Z" fill="url(#${uid}-recess)" stroke="${p.shade}"/>
  <path d="M64 18Q91 40 94 54v31l-10 18-20 15-20-15-10-18V54q3-14 30-36Z" stroke="${p.edge}" stroke-width=".8"/>
  <path d="M64 25Q85 42 87 55M41 55q2-13 23-30M32 69h7m50 0h7M34 89l8 4m44 0 8-4M64 17v9M64 115v8" stroke="${p.high}" stroke-width=".7" opacity=".65"/>
  <path d="m17 45-5 10v33l11 14M111 45l5 10v33l-11 14M38 21 30 25l-9 14M90 21l8 4 9 14" stroke="${p.edge}" stroke-width="1"/>
  <g transform="translate(40 42) scale(1.5)" stroke="#020709" stroke-width="1.5" opacity=".9"><path d="${glyph}" transform="translate(0 .7)"/></g>
  <g transform="translate(40 42) scale(1.5)" stroke="${p.light}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"><path d="${glyph}"/></g>
  <path d="M46 97h36M48 99h32" stroke="${p.high}" stroke-width=".5" opacity=".45"/>${rivets}
  ${state === "earned" ? `<path d="m99 96 11 10-11 12-11-12Z" fill="#14211f" stroke="${p.edge}"/><path d="m94 106 3 3 7-8" stroke="${p.high}" stroke-width="1.5"/>` : ""}
  <path d="M31 44h6m54 0h6M31 83h3m60 0h3M53 31l-2 3m26-3 2 3M47 117l4 1m26-1-4 1" stroke="${p.high}" stroke-width=".6" opacity=".45"/>
  </svg>`;
}
export function achievementMountSVG(state = "sealed") {
  const p = palette(state);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 152 292" preserveAspectRatio="none" fill="none">
  <defs><linearGradient id="stone" x2="1" y2="1"><stop stop-color="#243031" stop-opacity=".78"/><stop offset=".46" stop-color="#101c20" stop-opacity=".91"/><stop offset="1" stop-color="#071116" stop-opacity=".9"/></linearGradient></defs>
  <path d="M76 1 139 22 151 36v246l-9 9H10l-9-9V36l12-14Z" fill="#142329" fill-opacity=".86" stroke="${p.edge}" stroke-opacity="${state === "sealed" ? ".5" : ".85"}"/>
  <path d="M76 7 136 28l9 11v240l-7 6H14l-7-6V39l9-11Z" stroke="${p.edge}" stroke-width=".6" opacity=".28"/>
  <path d="M14 45v85m124-85v85M15 250v25h14m108-25v25h-14M23 152h20m66 0h20" stroke="${p.high}" stroke-width=".6" opacity=".3"/>
  <path d="M21 42 76 22l55 20M28 155l48 5 48-5M18 288h116" stroke="${p.edge}" stroke-width=".5" opacity=".35"/>
  <path d="M13 147h4m118 0h4M13 245h4m118 0h4" stroke="${p.edge}" opacity=".65"/>
  <path d="M76 3v6m-3-3h6" stroke="${p.high}" opacity=".7"/>
  </svg>`;
}
export function achievementPanelSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 468" preserveAspectRatio="none" fill="none">
  <defs><linearGradient id="glass" x1="0" y1="0" x2="700" y2="468" gradientUnits="userSpaceOnUse"><stop stop-color="#17262b" stop-opacity=".94"/><stop offset=".4" stop-color="#0c191f" stop-opacity=".95"/><stop offset="1" stop-color="#081219" stop-opacity=".97"/></linearGradient><linearGradient id="rim" x2="1" y2="1"><stop stop-color="#d0bb85"/><stop offset=".35" stop-color="#5a604d"/><stop offset=".7" stop-color="#a18e65"/><stop offset="1" stop-color="#c9b17a"/></linearGradient></defs>
  <path d="M16 1h668l15 15v436l-15 15H16L1 452V16Z" fill="#0d1b22" fill-opacity=".95" stroke="url(#rim)" stroke-opacity=".75"/>
  <path d="M18 7h664l11 11v432l-11 11H18L7 450V18Z" stroke="#a9976b" stroke-width=".65" opacity=".3"/>
  <path d="M24 76h652M24 411h652" stroke="#a9976b" stroke-opacity=".35" stroke-width=".6"/>
  <path d="M14 35V17h19m634 0h19v18M14 433v18h19m634 0h19v-18" stroke="#d0bb85" stroke-width="1"/>
  <path d="M350 3v8m-3-4h6M350 457v8m-3-4h6" stroke="#d0bb85" stroke-width=".7"/>
  <path d="M13 94v304m674-304v304" stroke="#a9976b" stroke-opacity=".19"/>
  <path d="M132 405V161q0-56 66-110 66 54 66 110v244m172 0V161q0-56 66-110 66 54 66 110v244M198 51v354m304-354v354" stroke="#b5b79d" stroke-opacity=".045" stroke-width="1"/>
  </svg>`;
}
