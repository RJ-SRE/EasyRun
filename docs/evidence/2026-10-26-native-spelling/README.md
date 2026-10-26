# v0.14.0 原生拼写机制验收

[汇总与交付包哈希](verification.json) · [23 项单词测试](words.json) · [15 项菜单与窗口测试](shell.json)。两套报告对应同一实际 `.xbp` 文件，使用网站部署的模型与编译组件在本地运行，未写入在线工程。

本次补齐中文释义、三档提示、逐字自动检查、错字即时取消以及更小题面。游戏内资源和题型由显式测试夹具固定以覆盖所有分支；测试函数不写入交付包，不将其表述为完整通关或全部词目人工审校。

- `hint-settings.png`：开始页难度下拉，2 秒首字母提示 / 1 秒完整隐藏。
- `spelling.png`、`typed.png`：中文及正确前缀，完整拼对无需 Enter。
- `spelling-hidden.png`、`spelling-recall.png`：两档隐藏后中文仍可见。
- `spelling-long.png`、`meaning-long.png`、`meaning-small.png`：长单词、28 字释义及小窗口。

复现命令（仓库根目录）：

```bash
python3 prototypes/runlab/package.py --game belfry
XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js RUNLAB_URL=http://127.0.0.1:4177/ bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-words.mjs
XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js RUNLAB_URL=http://127.0.0.1:4177/ bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-shell.mjs
```

服务器须从本工作树启动。测试只在本机使用网站公开运行组件；需要先有相应缓存。本次没有推送远程。
