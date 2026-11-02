/* global matchMedia, MutationObserver, Event */
// DOM controls sit over the same SPX menu scene used by the offline .xbp.
export function createMoonlitMenu({ send }) {
  const $ = (s) => document.querySelector(s),
    viewport = $("#viewport");
  const shell = document.createElement("section");
  shell.id = "moonlit-menu";
  shell.hidden = true;
  shell.innerHTML = `<div id="moonlit-logo" role="img" aria-label="裂隙"></div>
    <div class="moonlit-controls"><p class="moonlit-heading">远 征</p><div id="moonlit-start"></div><div id="moonlit-difficulty"></div><div id="moonlit-word"></div><div id="moonlit-ledger"></div><button id="menu-settings" aria-expanded="false" aria-controls="word-menu">远征设置 <span>›</span></button><div class="moonlit-links"><div id="moonlit-practice"></div><button id="menu-guide">操作指南 <kbd>H</kbd></button></div><div class="moonlit-footer"><span>静水之下，仍有回声。</span><button id="menu-audio" aria-label="调整音乐与音效">♫</button></div></div>`;
  viewport.append(shell);
  const wordMenu = $("#word-menu");
  wordMenu.classList.add("moonlit-settings");
  const close = document.createElement("button");
  close.id = "menu-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "关闭远征设置");
  wordMenu.querySelector(".word-loadout-head").append(close);
  wordMenu.querySelector("h2").textContent = "远征设置";
  $("#word-advanced").open = true;
  const tabs = document.createElement("div");
  tabs.className = "menu-settings-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.innerHTML =
    '<button id="menu-tab-words" role="tab" aria-controls="menu-pane-words" aria-selected="true">铭文</button><button id="menu-tab-sound" role="tab" aria-controls="menu-pane-sound" aria-selected="false">声音与画面</button>';
  wordMenu.querySelector(".word-loadout-head").after(tabs);
  const words = document.createElement("div");
  words.id = "menu-pane-words";
  words.setAttribute("role", "tabpanel");
  words.setAttribute("aria-labelledby", "menu-tab-words");
  for (const selector of [
    ".word-settings",
    ".word-actions",
    "#word-composition",
    "#word-continue",
    "#word-storage",
    ".local-reset-entry",
  ])
    words.append(wordMenu.querySelector(selector));
  wordMenu.querySelector(".word-note").hidden = true;
  wordMenu.append(words);
  const sound = document.createElement("div");
  sound.id = "menu-pane-sound";
  sound.hidden = true;
  sound.setAttribute("role", "tabpanel");
  sound.setAttribute("aria-labelledby", "menu-tab-sound");
  sound.innerHTML =
    '<label class="menu-volume">背景音乐 <output id="menu-music-value"></output><input id="menu-music-range" aria-label="菜单背景音乐音量" type="range" min="0" max="1" step="0.05"></label><label class="menu-volume">动作音效 <output id="menu-sfx-value"></output><input id="menu-sfx-range" aria-label="菜单动作音效音量" type="range" min="0" max="1" step="0.05"></label><label class="moonlit-motion"><span>减少动态</span><input type="checkbox" id="menu-reduced"></label><p class="menu-sound-note">关闭雾流、云间闪电、水纹与披风微动<br>音乐与音效独立调节</p>';
  wordMenu.append(sound);
  function syncSound() {
    for (const kind of ["music", "sfx"]) {
      const value = $("#setting-" + kind).value;
      $("#menu-" + kind + "-range").value = value;
      $("#menu-" + kind + "-value").textContent =
        Math.round(Number(value) * 100) + "%";
    }
  }
  function tab(name) {
    const audio = name === "sound";
    words.hidden = audio;
    sound.hidden = !audio;
    $("#menu-tab-words").setAttribute("aria-selected", String(!audio));
    $("#menu-tab-sound").setAttribute("aria-selected", String(audio));
    syncSound();
  }
  $("#menu-tab-words").onclick = () => tab("words");
  $("#menu-tab-sound").onclick = () => tab("sound");
  for (const kind of ["music", "sfx"])
    $("#menu-" + kind + "-range").oninput = (e) => {
      const original = $("#setting-" + kind);
      original.value = e.target.value;
      original.dispatchEvent(new Event("input", { bubbles: true }));
      syncSound();
    };
  let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    const v = localStorage.getItem("easyrun-menu-reduced");
    if (v !== null) reduced = v === "true";
  } catch {
    /* browser may disable storage */
  }
  $("#menu-reduced").checked = reduced;
  let initialized = false,
    active = false,
    settings = false,
    busy = false;
  const placements = [
    ["#play", "#moonlit-start"],
    ["#difficulty", "#moonlit-difficulty"],
    ["#practice", "#moonlit-practice"],
    [".word-switch", "#moonlit-word"],
    ["#word-preview", "#moonlit-ledger"],
  ].map(([a, b]) => {
    const node = $(a),
      marker = document.createComment("menu home " + a);
    node.before(marker);
    return { node, marker, destination: $(b) };
  });
  const wordHome = document.createComment("word menu home");
  wordMenu.before(wordHome);
  const signal = (code) => send(code, code, true, false);
  function refreshBusy() {
    document.body.classList.toggle(
      "moonlit-modal",
      active &&
        (!$("#word-journal").hidden ||
          !$("#guide").hidden ||
          !$("#settings-panel").hidden ||
          !$("#learning-ledger").hidden),
    );
    const next =
      active &&
      (settings ||
        !$("#word-journal").hidden ||
        !$("#guide").hidden ||
        !$("#settings-panel").hidden ||
        !$("#learning-ledger").hidden);
    $(".moonlit-controls").inert = next;
    wordMenu.inert =
      active &&
      (!$("#word-journal").hidden ||
        !$("#guide").hidden ||
        !$("#settings-panel").hidden ||
        !$("#learning-ledger").hidden);
    if (next !== busy) {
      busy = next;
      signal(next ? "Home" : "End");
    }
  }
  function openSettings(open, section = "words") {
    if (open) tab(section);
    settings = open;
    document.body.classList.toggle("moonlit-settings-open", open && active);
    $("#menu-settings").setAttribute("aria-expanded", String(open));
    refreshBusy();
    if (active) (open ? close : $("#menu-settings")).focus();
  }
  $("#menu-settings").onclick = () => openSettings(!settings);
  close.onclick = () => openSettings(false);
  $("#menu-guide").onclick = () => $("#help").click();
  $("#menu-audio").onclick = () => openSettings(true, "sound");
  $("#menu-reduced").onchange = (e) => {
    reduced = e.target.checked;
    signal("F7");
    try {
      localStorage.setItem("easyrun-menu-reduced", String(reduced));
    } catch {
      /* optional persistence */
    }
  };
  for (const id of [
    "#word-journal",
    "#guide",
    "#settings-panel",
    "#learning-ledger",
  ])
    new MutationObserver(refreshBusy).observe($(id), {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  function handleKey(e) {
    if (
      !active ||
      busy ||
      e.repeat ||
      e.inscriptionTransport ||
      e.target.closest?.("input,select,textarea,[contenteditable=true]")
    )
      return false;
    if (e.code !== "KeyH") return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    $("#help").click();
    return true;
  }
  document.addEventListener(
    "keydown",
    (e) => {
      if (handleKey(e)) return;
      if (!active || e.inscriptionTransport || $("#local-reset-dialog")?.open)
        return;
      if (
        (e.code === "Escape" && !$("#settings-panel").hidden) ||
        !$("#learning-ledger").hidden
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $("#close-settings").click();
        return;
      }
      if (e.code === "Escape" && !$("#guide").hidden) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $("#close-guide").click();
        return;
      }
      if (
        e.code === "Escape" &&
        settings &&
        $("#word-journal").hidden &&
        $("#guide").hidden &&
        $("#settings-panel").hidden
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openSettings(false);
      }
    },
    true,
  );
  const resize = () => {
    const r = viewport.getBoundingClientRect();
    shell.style.setProperty(
      "--menu-scale",
      Math.min(r.width / 960, r.height / 600),
    );
  };
  new ResizeObserver(resize).observe(viewport);
  resize();
  return {
    handleKey,
    receive(s) {
      if (!initialized) {
        initialized = true;
        if (reduced) signal("F7");
      }
      const next = s.phase === 0;
      if (next !== active) {
        active = next;
        shell.hidden = !next;
        document.body.classList.toggle("moonlit-title", next);
        if (next) {
          for (const p of placements) p.destination.append(p.node);
          shell.append(wordMenu);
          $(".word-switch span").textContent = "铭文挑战";
          document
            .querySelectorAll("#difficulty span")
            .forEach((n, i) => (n.textContent = i ? "5 格生命" : "8 格生命"));
          $("#practice").textContent = "排练场  T";
        } else {
          settings = false;
          for (const p of placements) p.marker.after(p.node);
          wordHome.after(wordMenu);
          document.body.classList.remove("moonlit-settings-open");
        }
        refreshBusy();
      }
      if (next) {
        $("#menu-audio").textContent =
          "♫ 音乐 " + Math.round(Number($("#setting-music").value) * 100) + "%";
        $("#difficulty").hidden = false;
        $("#play").hidden = false;
        $("#practice").hidden = false;
      }
    },
  };
}
