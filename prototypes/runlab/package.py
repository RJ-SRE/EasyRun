"""Package generated spx projects, including native music for Belfry exports."""
import argparse
import hashlib
import json
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
        main = files["main.spx"].decode()
        marker = "// EXPORT_NATIVE_MUSIC_TICK"
        assert main.count(marker) == 1, "Rebuild Belfry before packaging native music"
        main = main.replace(marker, "updateNativeMusic()")
        # Classfiles allow one field block; all methods precede event registrations.
        native = (ROOT / "spx/belfry/NativeMusic.spx").read_text()
        declarations, native = native.split("\n)\n", 1)
        fields = declarations.split("var (\n", 1)[1]
        assert main.count("var (\n") == 1
        main = main.replace("var (\n", "var (\n" + fields + "\n", 1)
        events = "onKey KeyT,"
        assert main.count(events) == 1
        main = main.replace(events, native + "\n" + events)
        files["main.spx"] = main.encode()
        files.update(native_music_files())
        instructions = (
            "本 XBuilder 包默认纯动作，内置三首完整背景音乐。首次运行后点击舞台或按 Enter 解锁浏览器声音；"
            "开始、游戏、胜利或失败各自单曲循环。Esc 暂停时音乐暂停，继续时从原位置播放；B 开关背景音乐。"
            "1/2 选难度；Enter 开始或续关；A/D 移动；W 跳跃/二段跳；O 牵引后松开甩出；"
            "J 三连，W+J 挑空，S+J 坠星；U 蓄箭，L 蓄刀，蓄力时 W/S 向上/下瞄准；"
            "I 回息，P 连环剑刀；U/L/I 冷却 3 秒，P 冷却 5 秒。K/Shift 冲刺，W+K 向上；"
            "双击 S 下平台；R 重开；Esc 暂停；M 在暂停/结算返回标题；T 排练。"
            "网页提供的铭文题目、词册、成就、存档和战斗音效混音不包含在单个 xbp 内。角色语音保持关闭。"
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
