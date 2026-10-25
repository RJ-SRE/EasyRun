"""Package only the independent passage level; never touches combat exports."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent
(root/'exports').mkdir(exist_ok=True)
target=root/'exports/passages.xbp'
manifest=json.loads((root/'public/passages.json').read_text())
with ZipFile(target,'w',ZIP_DEFLATED) as z:
 z.writestr('builder-meta.json',json.dumps({'type':'game','displayName':'裂隙 · 回路遗迹','description':'横向回廊、换壁深井、配重机房、摆渡长廊与逆风竖塔。独立无敌人关卡。','instructions':'Enter 开始/检查点继续，A/D 移动，空格二段跳/蹬墙，E 按住钩索与拉环，松开甩出，方向键辅助选点，K/Shift 冲刺，S+空格下穿，Esc 暂停，R 重开。'},ensure_ascii=False))
 for p in sorted(manifest):z.write(root/'projects/passages'/p,p)
with ZipFile(target) as z:assert z.testzip() is None
print(str(target),target.stat().st_size)
