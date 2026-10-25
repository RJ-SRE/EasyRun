"""Package generated spx projects in XBuilder's .xbp ZIP format."""
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
for game, (name, description) in GAMES.items():
    metadata = {
        "type": "game",
        "displayName": name + " · 玩法原型",
        "description": description,
        "instructions": "本包为舞台简化版，不等于网页截图。1/2 旅人/无畏；F4 铭文开关；N 声音开关；Enter 开始；C 续关（本局检查点）。铭文开启后技能会出题：拼写按字母，辨义按1/2/3。A/D 移动；空格二段跳；E 牵引后松开甩出；J 三连，W+J 挑空，S+J 坠星；U 蓄箭，L 蓄刀，I 回息，Q 五段连环剑刀（U/L/I 冷却 3 秒，Q 冷却 5 秒；释放后按有效战斗时间计时，仍需完成动作收势）；K/Shift 冲刺；S+空格下平台；Esc 暂停；M 回菜单；R 重开。30 词面板、浏览器存档和混音滑杆仍在网页宿主。角色语音与对白关闭。" if game == "belfry" else "Enter 开始；A/D 移动；空格跳跃；E 特殊动作；S 滑行；R 重来；Esc 暂停。推荐使用配套本地试玩页面查看中文提示、分数与结算。",
    }
    target = DEST / (game + ".xbp")
    with ZipFile(target, "w", ZIP_DEFLATED) as z:
        z.writestr("builder-meta.json", json.dumps(metadata, ensure_ascii=False, indent=2))
        manifest = json.loads((ROOT / "public" / (game + ".json")).read_text())
        for relative in sorted(manifest):
            source = ROOT / "projects" / game / relative
            if game == "belfry" and relative == "main.spx":
                text = source.read_text()
                text = text.replace("// HOST_CONFIGURATION", "stageHost=1; wordMode=1")
                z.writestr(relative, text)
            else:
                z.write(source, relative)
    with ZipFile(target) as z:
        assert z.testzip() is None
        required = {"main.spx", "Hero.spx", "assets/index.json", "builder-meta.json"}
        if game == "belfry":
            required.add("StageHud.spx")
            packed = z.read("main.spx").decode("utf-8")
            assert "stageHost=1" in packed
            assert "wordMode=1" in packed
            assert "wordText=[]string{" in packed
            assert "// HOST_CONFIGURATION" not in packed
        assert required.issubset(z.namelist())
    print(f"Packaged {target.name}: {target.stat().st_size:,} bytes")
