# 固定词源提取

在仓库根目录执行。常规修改直接运行 `scripts/build-wordbank.mjs` 即可，以下仅用于重做来源审计。Python 环境需要 `pdfplumber`、`pypdf`；运行时游戏不依赖它们。

将下列固定源文件保存到 `.cache/wordbank-v2/`，不把完整上游字典、PDF 加入 Git：

- `cet2016.pdf`：https://www.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf
- `ecdict.csv`：https://raw.githubusercontent.com/skywind3000/ECDICT/ab22ad36302cafc6349a050e2b60894855208055/ecdict.csv

```sh
python3 scripts/wordbank/extract-pdf.py
python3 scripts/wordbank/extract-text.py
python3 scripts/wordbank/normalize.py
bash scripts/with-env.sh node scripts/build-wordbank.mjs
bash scripts/with-env.sh node --test prototypes/runlab/test-inscription-core.mjs
```

`extract-pdf.py` 根据页面位置区分主词与派生词，处理星号与同形词编号的基线；`extract-text.py` 补充文本分行的派生词。`normalize.py` 强制检查源文件 SHA-256，再展开括号、并列与缩写词形；不在固定字典内的展开形式进入缺失清单，禁止静默放行。输出规范源、覆盖摘要和逐行映射。

原始 PDF 第 21 页已渲染并与坐标提取对照。页码使用 PDF 从 1 开始的物理页，不是书内页码。正式变更源版本时，应重新审计等级、词形和缺失项，不仅调整计数断言。
