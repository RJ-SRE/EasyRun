# EasyRun 常用词数据来源与许可

内容版本：common-ngsl-nawl-2026-11-01.1。获取日期：2026-11-01。

- **New General Service List 1.2**，Charles Browne、Brent Culligan、Joseph Phillips，2,809 个核心词。来源：https://www.newgeneralservicelist.com/new-general-service-list 。文件：`ngsl-1.2.csv`，官方频率顺序。
- **NGSL 补充词**，同一作者、同一来源，52 个日期／数字词，去重后增加 50 词。文件：`ngsl-supplement.csv`。
- **New Academic Word List 1.2**，同一作者，957 个进阶扩展词。来源：https://www.newgeneralservicelist.com/new-academic-word-list 。文件：`nawl-1.2.txt`。
- 上述词表采用 **CC BY-SA 4.0**：https://creativecommons.org/licenses/by-sa/4.0/ 。本项目对其进行大小写规范化、合并去重、游戏分层及题面扩展；衍生词表、生成的数据文件与词表编辑贡献按同一许可提供。作者不为本游戏背书。游戏程序、美术、音频各自沿用其独立许可。
- 中文词典：**ECDICT**，skywind3000/ECDICT，固定提交 `ab22ad36302cafc6349a050e2b60894855208055`，MIT License。来源：https://github.com/skywind3000/ECDICT 。保留许可全文于 `ECDICT-LICENSE.txt`。`ecdict-common.json` 是该 CSV 按所选词头提取的可复现子集，原 CSV SHA-256 记录在文件内。

最终 3,816 个去重词头。普通 1,550（NGSL 前 1,500 + 日期数字），困难 1,309（其余 NGSL），挑战 957（NAWL）。这是游戏的词频／用途分层，**不是 Oxford、CEFR 或四、六级官方分级**。不把论文覆盖率当作玩家学习效果。

中文释义经固定词典规范化并包含 319 条编辑覆盖；并未完成全量人工语言学复核。高频多义词通过词性、限定常用义与简短语境消歧。干扰项优先从同词性、同档真实词义中选取，拒绝词典已列出的重合义与常见同义组；不足时用显著不相干的题面。潜在语义问题可在 `sense-overrides.json` 修正，构建会变更该词的释义修订号。

复现：`bash scripts/with-env.sh node scripts/build-common-wordbank.mjs`。源文件、生成内容及 SHA-256 位于 `services/learning/content-common/manifest.json`。联网下载不参与构建过程。
