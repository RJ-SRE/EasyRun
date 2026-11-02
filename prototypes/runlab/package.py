"""Package SPX projects with Belfry native UI, inscriptions, audio and attribution."""
import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from native_runtime import optimize_native_runtime
from native_viewport import full_bleed_native

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "exports"
DEST.mkdir(exist_ok=True)
GAMES = {
    "belfry": ("裂隙 · 倒悬钟城", "钩索纵向动作冒险：下潜、击破刺客守心者、携心向上逃离。旅人与无畏两档难度，检查点继续。"),
    "rupture": ("裂隙 · 盗速者", "夺取风机动能使叶片停下，但供能桥开始坠落；冻结升降机构，选择上下路线。"),
    "velocity": ("盗速者", "吸取城市运输车的动能，再释放动能跨越断桥。"),
    "cinema": ("一镜到底", "翻越木箱、滑过横梁、跃过断口，完成六个连续特技镜头。"),
}
MUSIC_NAMES = {"menu": "BGM_Menu", "gameplay": "BGM_Gameplay", "ending": "BGM_Ending"}


def native_cover_files(config, files):
    """Supply both XBP metadata and a default editor stage worth photographing.

    Builder refreshes thumbnails from its static StageViewer. A metadata-only
    cover is therefore insufficient. Put the cover above the scene at the map's
    initial viewport, and first in the sprite list so selection does not pan away.
    Runtime hides it at startup; it has no loop, collision, clicks or clones.
    """
    image = (ROOT / "art/belfry/cover.png").read_bytes()
    assert image[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = struct.unpack(">II", image[16:24])
    vw, vh = config["run"]["width"], config["run"]["height"]
    assert width * vh == height * vw, "Cover must match Builder's 4:3 viewport"
    sprite = "ProjectCover"
    folder = f"assets/sprites/{sprite}"
    assert sprite not in config["zorder"]
    config["zorder"].append(sprite)
    costume = {
        "x": (vw - config["map"]["width"]) / 2,
        "y": (config["map"]["height"] - vh) / 2,
        "heading": 90, "size": vw / width, "rotationStyle": "none",
        "physicsMode": "no", "collisionShapeType": "none", "triggerShapeType": "none",
        "visible": True, "costumeIndex": 0,
        "costumes": [{"name": "cover", "path": "cover.png", "x": width / 2,
                      "y": height / 2, "bitmapResolution": 1}],
    }
    info = {"selection": "C", "title": "暗金裂痕", "width": width, "height": height,
            "sha256": hashlib.sha256(image).hexdigest(), "editorSprite": sprite,
            "thumbnail": "builder-thumbnail.png", "runtime": "hidden-on-start"}
    additions = {
        "builder-thumbnail.png": image,
        f"{folder}/cover.png": image,
        f"{folder}/index.json": json.dumps(costume).encode(),
        f"{sprite}.spx": b"// Editor-only publishing artwork. Never displayed during play.\nonStart => {hide}\n",
        "native-cover-manifest.json": json.dumps(info, ensure_ascii=False, indent=2).encode(),
    }
    # Builder orders sprites by builder_id, not name. Assign stable IDs to all
    # entries: unlisted IDs sort before listed IDs in Builder's orderBy helper.
    ids = {}
    for name in config["zorder"]:
        path = f"assets/sprites/{name}/index.json"
        raw = json.loads(additions[path] if path in additions else files[path])
        ids[name] = raw.setdefault("builder_id", "er-" + hashlib.sha256(name.encode()).hexdigest()[:20])
        additions[path] = json.dumps(raw, ensure_ascii=False).encode()
    assert len(set(ids.values())) == len(ids), "Duplicate editor sprite ID"
    config["builder_spriteOrder"] = [ids[sprite], *[ids[n] for n in config["zorder"] if n != sprite]]
    return additions


def native_music_files():
    """Package prepared MP3 bytes without further transcoding; validate the asset manifest."""
    manifest = json.loads((ROOT / "public/audio/music/manifest.json").read_text())
    tracks = manifest["tracks"]
    assert len(tracks) == 3 and {t["stage"] for t in tracks} == set(MUSIC_NAMES)
    files = {}
    for track in tracks:
        audio = (ROOT / "public" / track["file"].lstrip("/")).read_bytes()
        assert len(audio) == track["bytes"], track["file"]
        assert hashlib.sha256(audio).hexdigest() == track["sha256"], track["file"]
        folder = f"assets/sounds/{MUSIC_NAMES[track['stage']]}"
        files[f"{folder}/sound.mp3"] = audio
        files[f"{folder}/index.json"] = json.dumps({
            "path": "sound.mp3", "rate": 0, "sampleCount": 0,
        }).encode()
    files["native-music-manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
    return files


def package(game):
    name, description = GAMES[game]
    manifest = json.loads((ROOT / "public" / (game + ".json")).read_text())
    files = {relative: (ROOT / "projects" / game / relative).read_bytes() for relative in sorted(manifest)}
    instructions = "Enter 开始；A/D 移动；空格跳跃；E 特殊动作；S 滑行；R 重来；Esc 暂停。推荐使用配套本地试玩页面查看中文提示、分数与结算。"
    if game == "belfry":
        main = files["main.spx"].decode().replace('import "math"', 'import "math"\nimport "fmt"\nimport "strings"')
        marker = "// EXPORT_NATIVE_MUSIC_TICK"
        assert main.count(marker) == 1, "Rebuild Belfry before packaging native music"
        main = main.replace(marker, "updateNativeMusic()")
        subprocess.run(["bash", str(ROOT.parent.parent / "scripts/with-env.sh"), "node", str(ROOT / "build-belfry-native.mjs")], check=True)
        ui_root = ROOT / "projects/belfry-native"
        ui = json.loads((ui_root / "manifest.json").read_text())
        # Classfiles allow one field block, with all methods before event registration.
        methods = []
        main = 'import "syscall/js"\n' + main
        for source in ["NativeMusic", "NativeShell", "NativeWords", "NativeLedger", "NativeCombat", "NativeLearning", "NativeCloud", "NativeLocal", "NativeStudy"]:
            native = (ROOT / f"spx/belfry/{source}.spx").read_text()
            declarations, native = native.split("\n)\n", 1)
            fields = declarations.split("var (\n", 1)[1]
            assert main.count("var (\n") == 1
            main = main.replace("var (\n", "var (\n" + fields + "\n", 1)
            methods.append(native)
        methods.append((ui_root / "native-layout.spx").read_text())
        methods.append((ui_root / "native-word-data.spx").read_text())
        # Keys held when a question opens/closes stay quarantined until key-up.
        # Mask polling as well as events: a delayed jump/skill is still a leak.
        keys = [f"Key{c}" for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"] + ["KeyLeft", "KeyRight", "KeyUp", "KeyDown", "KeyShift", "KeySpace", "KeyMinus", "KeyEnter", "KeyBackspace"]
        assert len(keys) <= 64
        methods.append("func nativeCaptureHeld() {\n" + "\n".join(
            f" if keyPressed({key}) {{nativeHeld[{i}]=true}}" for i, key in enumerate(keys)
        ) + "\n}\nfunc nativeReleaseHeld() {\n" + "\n".join(
            f" if nativeHeld[{i}] && !keyPressed({key}) {{nativeHeld[{i}]=false}}" for i, key in enumerate(keys)
        ) + "\n}\n" + "\n".join(
            f"func native{key}() bool {{return !nativeHeld[{i}] && keyPressed({key})}}" for i, key in enumerate(keys)
        ))
        hero = files["Hero.spx"].decode()
        for key in keys:
            hero = hero.replace(f"keyPressed({key})", f"native{key}()")
        files["Hero.spx"] = hero.encode()
        events = "onKey KeyT,"
        assert main.count(events) == 1
        main = main.replace(events, "\n".join(methods) + "\n" + (ROOT / "spx/belfry/NativeBindings.spx").read_text() + "\n" + events)
        shell_marker = "// EXPORT_NATIVE_SHELL_TICK"
        assert main.count(shell_marker) == 1, "Rebuild Belfry before packaging the menu"
        main = main.replace(shell_marker, "updateNativeCloud(); updateNativeLocal(); syncNativeAudioPosition(); updateNativeShell(dt)")
        main = main.replace("// HOST_CONFIGURATION", "initNativeWords(); nativeMusicVolume=75; nativeSfxVolume=85; initNativeLocal()")
        main = main.replace('func event(name string) {', 'func event(name string) {\n nativeCloudEvent(name); nativeLearningEvent(name); nativeLocalEvent(name); nativeSoundEvent(name); nativeCombatEvent(name)')
        main = main.replace('func startRun() {', 'func startRun() {\n if !nativeCloudBeforeStart() {return}')
        main = main.replace(' startRun(); practice=1; practiceKind=kind', ' nativeCloudPractice=true; startRun(); nativeCloudPractice=false; practice=1; practiceKind=kind')
        main = main.replace('func enemyEvent(name string,i int) {', 'func enemyEvent(name string,i int) {nativeCombatEvent(name); ')
        main = main.replace('Hero.captureAttack()', 'if nativeInputLock<=0 {Hero.captureAttack()}')
        main = main.replace('Hero.update(dt)', 'if nativeInputLock<=0 {Hero.update(dt)}')
        # Native UI consumes game fields directly. Keep lightweight diagnostics
        # at 4 Hz, but omit detailed web-host enemy/quest snapshots from .xbp.
        assert main.count("float64(timer)-lastState>0.07") == 1
        main = main.replace("float64(timer)-lastState>0.07", "float64(timer)-lastState>0.25")
        handlers = {"KeyEnter": "nativeConfirm()", "KeyEscape": "nativePause()", "KeyM": 'if phase==5 || nativePreview {nativeType("m")} else if nativeInputLock<=0 {nativeReturnTitle()}'}
        lines = []
        for line in main.splitlines():
            if 'println "@hunt"' in line or 'println "@keeperLine"' in line or line.strip() == 'emitExpedition()':
                continue
            key = next((key for key in handlers if line.startswith(f"onKey {key},")), None)
            if key:
                line = f"onKey {key}, => {{" + handlers[key] + "}"
            elif any(line.startswith(f"onKey {key},") for key in ["KeyF1", "KeyF2", "KeyF3", "KeyF4"]):
                # Native answers must pass validation; remove web-host reply shortcuts.
                continue
            elif any(line.startswith(f"onKey {key},") for key in ["KeyF", "KeyV"]):
                prefix, body = line.split("=> {", 1)
                letter = "f" if line.startswith("onKey KeyF,") else "v"
                line = prefix + f'=> {{if phase==5 || nativePreview {{nativeType("{letter}")}} else if nativeInputLock<=0 {{' + body + "}"
                if letter == "v":
                    line = line.replace('else if nativeInputLock<=0', 'else if phase==0 {nativeCloudTakeover()} else if nativeInputLock<=0')
            elif any(line.startswith(f"onKey {key},") for key in ["KeyT", "KeyR", "Key1", "Key2", "Key3", "Key4", "Key5", "Key6", "Key7", "Key8", "Key9"]):
                prefix, body = line.split("=> {", 1)
                if any(line.startswith(f"onKey Key{n},") for n in [1, 2, 3]):
                    n = int(line.split("Key", 2)[2][0])
                    line = prefix + f"=> {{if phase==5 {{nativeChoose({n-1})}} else if !nativeHelp && !nativePreview && nativeInputLock<=0 {{" + body + "}"
                elif line.startswith("onKey KeyT,") or line.startswith("onKey KeyR,"):
                    letter = "t" if line.startswith("onKey KeyT,") else "r"
                    line = prefix + f'=> {{if phase==5 || nativePreview {{nativeType("{letter}")}} else if !nativeHelp && !nativePreview && nativeInputLock<=0 {{' + body + "}"
                else:
                    line = prefix + "=> {if phase!=5 && !nativeHelp && !nativePreview && nativeInputLock<=0 {" + body + "}"
            if line.startswith("onKey ") and not any(line.startswith(f"onKey {k},") for k in ["KeyEnter", "KeyEscape", "KeyTab", "KeyLeft", "KeyRight"]):
                line = line.replace("=> {", "=> {if nativeLocalResetStage>0 || nativeStudyOpen {return}; ", 1)
            for i, key in enumerate(keys):
                if line.startswith(f"onKey {key},"):
                    line = line.replace("=> {", f"=> {{if nativeHeld[{i}] {{return}}; ", 1)
                    break
            lines.append(line)
        main = "\n".join(lines) + "\n"
        # Native text uses dynamic clones; include them in the global 300-slot budget.
        main = main.replace("sceneClones+fxCount+projectileCount>=240", "sceneClones+nativeGlyphCount+fxCount+projectileCount>=240")
        for effect in ["Particle", "Trail", "Pulse", "Slash", "PoseBlend", "EnemyBlend", "SkillFX"]:
            path = effect + ".spx"
            source = files[path].decode()
            source = "var nativeAlive bool\n" + source.replace("onCloned data => {", "onCloned data => {nativeAlive=true", 1)
            source = source.replace("fxCount--;", "nativeAlive=false; fxCount--;")
            source += '\nonMsg "nativeCullFX", => {if nativeAlive && sceneClones+nativeTextCount+fxCount+projectileCount>=280 {nativeAlive=false; fxCount--; destroy}}\n'
            files[path] = source.encode()

        for relative in ui.get("removedFiles", []):
            files.pop(relative, None)
        for relative in ui["files"]:
            if relative not in ["native-layout.spx", "native-word-data.spx"]:
                files[relative] = (ui_root / relative).read_bytes()
        config = json.loads(files["assets/index.json"])
        config["stretchMode"] = False
        config["run"] = {"width": 480, "height": 360}
        config["camera"] = {"on": ""}
        # Nonzero attenuation keeps sounds attached to their persistent owners.
        # Both owners follow the camera. Builder also exports these settings for
        # a large map; do not rely on an oversized distance it would overwrite.
        config["audioAttenuation"] = 1
        config["audioMaxDistance"] = 768
        config["zorder"].extend(ui["zorder"])
        files["main.spx"] = main.encode()
        menu_geometry = json.loads((ROOT / "art/belfry/menu/static-validation.json").read_text())
        files["native-menu-geometry.json"] = json.dumps({
            key: menu_geometry[key]["rect"] for key in ("cloth", "water", "lightning", "fog")
        }).encode()
        full_bleed_native(files)
        optimize_native_runtime(config, files)
        files.update(native_cover_files(config, files))
        files["assets/index.json"] = json.dumps(config).encode()
        files.update(native_music_files())
        for notice in ["docs/WORD_BANK.md", "docs/BOSS_AND_COMMON_V220.md", "docs/ACHIEVEMENT_ARCHIVE_V221.md", "docs/LOCAL_RESET_V222.md", "prototypes/runlab/data/common-sources/NOTICE.md", "prototypes/runlab/data/common-sources/ECDICT-LICENSE.txt", "docs/LEARNING_RAILS_V190.md", "docs/BOSS_REWORK_V200.md", "docs/BOSS_EVOLUTION_V210.md", "docs/BOSS_REDESIGN_V2.md", "docs/evidence/inscription-v1/ECDICT-LICENSE.txt"]:
            files[notice] = (ROOT.parent.parent / notice).read_bytes()
        instructions = (
            "本 XBuilder 包内置开始界面、难度选择、操作指南、暂停与结算菜单、生命/技能 HUD，以及三首完整背景音乐。首次点击舞台解锁声音，点击进入钟城或按 Enter 开始；"
            "开始、游戏、胜利或失败各自单曲循环。Esc 暂停/继续；B 音乐开关；H 操作指南。背景铺满窗口，菜单背景按比例裁切，角色与控件保持比例和完整显示。"
            "1/2 选难度；Enter 开始或续关；A/D 移动；W 跳跃/二段跳；O 牵引后松开甩出；"
            "J 三连，W+J 挑空，S+J 坠星；U 蓄箭，L 蓄刀，蓄力时 W/S 向上/下瞄准；"
            "I 回息，P 连环剑刀；U/L/I 冷却 3 秒，P 冷却 5 秒。K/Shift 冲刺，W+K 向上；"
            "双击 S 下平台；R 重开；Esc 暂停；M 在暂停/结算返回标题；T 排练。"
            "Tab 或点击铭文进度打开随行词册；支持本局/薄弱/完整词库范围与英文搜索，Esc/Tab 合上。战斗中查看会暂停，合上后继续；答题中不能打开词册。"
            "包内含 3816 条常用及进阶词汇，单词选择为普通、困难、挑战、随机，每局抽取 30 个不同单词；拼写/三选一辨义、错题取消技能、结合本机薄弱记录安排复习。拼写始终显示中文释义，拼对自动释放、首个错字立即取消；完整提示/2 秒渐隐/1 秒回忆可在标题选择。1/2/3 辨义，Esc 暂停答题。开始或暂停菜单可分别拖动音乐与音效滑条。学习记录与设置自动保存在当前浏览器网站，按用户名区分；清除网站数据会丢失，不跨设备同步。上下渐变边带内置英语成就入口和本局/累计词库进度；24 项英语成就保存在本机档案，打开成就册暂停当前战斗或答题但保留音乐，关闭后恢复。方向键翻页，Esc 或 Enter 合上。守心者有守铠、断锋、缚心三种结构外形与九种实体武器招式；回流在答题期间继续，连续命中两次不同施放的 U/L/P 可打断，每形态限两次。主动暂停仍冻结回流。角色语音保持关闭。"
        )
    metadata = {"type": "game", "displayName": name + " · 玩法原型", "description": description, "instructions": instructions}
    files["builder-meta.json"] = json.dumps(metadata, ensure_ascii=False, indent=2).encode()
    target = DEST / (game + ".xbp")
    # Write a temporary archive first; a failed build must not replace a usable export.
    temporary = target.with_suffix(".xbp.tmp")
    with ZipFile(temporary, "w", ZIP_DEFLATED) as archive:
        for relative, content in files.items():
            archive.writestr(relative, content)
    with ZipFile(temporary) as archive:
        assert archive.testzip() is None
        assert {"main.spx", "Hero.spx", "assets/index.json", "builder-meta.json"}.issubset(archive.namelist())
        for relative, content in files.items():
            assert archive.read(relative) == content, relative
    temporary.replace(target)
    print(f"Packaged {target.name}: {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game", choices=GAMES, help="Package only the selected game")
    args = parser.parse_args()
    for game in [args.game] if args.game else GAMES:
        package(game)
