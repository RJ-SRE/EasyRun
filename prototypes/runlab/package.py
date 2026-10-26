"""Package SPX projects with Belfry native UI, inscriptions, audio and attribution."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

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


def native_music_files():
    """Use original MP3 bytes; validate provenance before producing an export."""
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
        for source in ["NativeMusic", "NativeShell", "NativeWords", "NativeLedger"]:
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
            f" if !keyPressed({key}) {{nativeHeld[{i}]=false}}" for i, key in enumerate(keys)
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
        main = main.replace(shell_marker, "updateNativeShell(dt)")
        main = main.replace("// HOST_CONFIGURATION", "initNativeWords(); nativeMusicVolume=65; nativeSfxVolume=30")
        main = main.replace('func event(name string) {', 'func event(name string) {\n nativeSoundEvent(name)')
        main = main.replace('Hero.captureAttack()', 'if nativeInputLock<=0 {Hero.captureAttack()}')
        main = main.replace('Hero.update(dt)', 'if nativeInputLock<=0 {Hero.update(dt)}')
        handlers = {"KeyEnter": "nativeConfirm()", "KeyEscape": "nativePause()", "KeyM": 'if phase==5 || nativePreview {nativeType("m")} else if nativeInputLock<=0 {nativeReturnTitle()}'}
        lines = []
        for line in main.splitlines():
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
        config["zorder"].extend(ui["zorder"])
        files["assets/index.json"] = json.dumps(config).encode()
        files["main.spx"] = main.encode()
        files.update(native_music_files())
        for notice in ["docs/WORD_BANK.md", "docs/evidence/inscription-v1/ECDICT-LICENSE.txt"]:
            files[notice] = (ROOT.parent.parent / notice).read_bytes()
        instructions = (
            "本 XBuilder 包内置开始界面、难度选择、操作指南、暂停与结算菜单、生命/技能 HUD，以及三首完整背景音乐。首次点击舞台解锁声音，点击进入钟城或按 Enter 开始；"
            "开始、游戏、胜利或失败各自单曲循环。Esc 暂停/继续；B 音乐开关；H 操作指南。窗口按比例完整显示，宽窄比例不同会留边。"
            "1/2 选难度；Enter 开始或续关；A/D 移动；W 跳跃/二段跳；O 牵引后松开甩出；"
            "J 三连，W+J 挑空，S+J 坠星；U 蓄箭，L 蓄刀，蓄力时 W/S 向上/下瞄准；"
            "I 回息，P 连环剑刀；U/L/I 冷却 3 秒，P 冷却 5 秒。K/Shift 冲刺，W+K 向上；"
            "双击 S 下平台；R 重开；Esc 暂停；M 在暂停/结算返回标题；T 排练。"
            "Tab 或点击铭文进度打开随行词册；支持本局/薄弱/完整词库范围与英文搜索，Esc/Tab 合上。战斗中查看会暂停，合上后继续；答题中不能打开词册。"
            "包内含 8815 条四、六级词汇，随机 30 词、拼写/三选一辨义、错题取消技能、错词本次运行优先。拼写始终显示中文释义，拼对自动释放、首个错字立即取消；完整提示/2 秒渐隐/1 秒回忆可在标题选择。1/2/3 辨义，Esc 暂停答题。开始或暂停菜单可分别拖动音乐与音效滑条。运行内记忆保留，关闭或重新运行 XBuilder 后重置；网页版跨次存档与成就尚未迁入。角色语音保持关闭。"
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
