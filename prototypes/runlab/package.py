"""Package generated spx projects in XBuilder's .xbp ZIP format."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "exports"
DEST.mkdir(exist_ok=True)
GAMES = {
    "belfry": ("裂隙 · 倒悬钟城", "钩索纵向动作冒险：下潜、击破钟卫、携心向上逃离。旅人与无畏两档难度，检查点继续。"),
    "rupture": ("裂隙 · 盗速者", "夺取风机动能使叶片停下，但供能桥开始坠落；冻结升降机构，选择上下路线。"),
    "velocity": ("盗速者", "吸取城市运输车的动能，再释放动能跨越断桥。"),
    "cinema": ("一镜到底", "翻越木箱、滑过横梁、跃过断口，完成六个连续特技镜头。"),
}
for game, (name, description) in GAMES.items():
    metadata = {
        "type": "game",
        "displayName": name + " · 玩法原型",
        "description": description,
        "instructions": "1/2 选择难度；Enter 开始或检查点继续；A/D 移动；空格二段跳；按住 E 牵引、松开甩出；J 三连；W+J 挑空；按住 L 蓄力松开重击；S+J 坠星；K/Shift 冲刺；W+K 上冲；Q 断弦；S+空格下平台；R 从头开始；Esc 暂停；开场或暂停后 T 排练场。配套本地试玩页面提供中文界面、动作音效、环境音乐、战绩与结算；当前不提供角色语音或对白。" if game == "belfry" else "Enter 开始；A/D 移动；空格跳跃；E 特殊动作；S 滑行；R 重来；Esc 暂停。推荐使用配套本地试玩页面查看中文提示、分数与结算。",
    }
    target = DEST / (game + ".xbp")
    with ZipFile(target, "w", ZIP_DEFLATED) as z:
        z.writestr("builder-meta.json", json.dumps(metadata, ensure_ascii=False, indent=2))
        manifest = json.loads((ROOT / "public" / (game + ".json")).read_text())
        for relative in sorted(manifest):
            z.write(ROOT / "projects" / game / relative, relative)
    with ZipFile(target) as z:
        assert z.testzip() is None
        assert {"main.spx", "Hero.spx", "assets/index.json", "builder-meta.json"}.issubset(z.namelist())
    print(f"Packaged {target.name}: {target.stat().st_size:,} bytes")
