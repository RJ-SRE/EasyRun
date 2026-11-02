# 正式内容输入契约

本目录只有输入说明。`legacy-test/` 是从现有游戏词库生成的本地测试数据，不作为正式常用词库分发；运行 `build-test-content.mjs` 可重现。

未来输入目录同时包含 `words.json` 与 `manifest.json`，两者版本必须一致。单词示例（**仅展示字段，不代表完成词库或审核**）：

```json
{
  "schemaVersion": 1,
  "lexiconId": "en-core",
  "contentVersion": "core-draft-1",
  "wordIdScheme": "en-stable-id-v1",
  "words": [{
    "wordId": "en:book",
    "word": "book",
    "acceptedSpellings": ["book"],
    "pos": "n.",
    "meaning": "书",
    "distractors": ["杯子", "桥"],
    "cefr": "A1",
    "difficulty": "normal",
    "spellable": true,
    "enabled": true,
    "reviewed": false,
    "provenanceRef": "review/word-book.md"
  }]
}
```

清单必须包括 `schemaVersion,lexiconId,contentVersion,wordIdScheme,wordCount,wordsKey,wordsSha256,difficultyCounts,selectionSource,sourceEdition,sourceUrl,sourceRetrievedAt,provenanceRef,usageStatus,draft,publishedAt`。

- `wordCount` 是启用数；`difficultyCounts` 的 normal/hard/challenge 之和等于它。随机池是启用词条并集。
- `wordsSha256` 对实际 UTF-8 文件的原始字节计算，包含文件尾换行。
- 正式校验需 `usageStatus:"verified"`、`draft:false`、逐词 `reviewed:true`、每池至少 30 词。不能为了通过校验直接改标记，审核材料须真实存在并可追溯。
- 稳定 ID 沿用旧词目身份；不能以数组位置、难度、释义生成。英美变体允许作答不意味着自动合并旧历史。
- 同一 ID 固定一个目标词性、义项和分级；如要改变义项，先定义迁移而不是覆盖旧词。
- 需语境的词应先完成语境题面在原生版的呈现及审核；当前独立展示无法消歧时不得启用。当前校验只能验证结构，无法自动证明语义正确。

本轮没有下载并宣称完成 Oxford 3000，也没有把公开页面可读当作可打包分发的证明。
