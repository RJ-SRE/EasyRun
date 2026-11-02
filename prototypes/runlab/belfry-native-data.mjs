// Store bulk data as a handful of literals, not tens of thousands of SSA nodes.
// Decoding happens once at startup. Rows, ordering, glyphs and metrics stay exact.
export function nativeWordData(rows, entries, glyphs, core = false) {
  const quote = JSON.stringify;
  const separator = "\u001f";
  const columns = [
    ["nativeWordIDs", "id"],
    ["nativeWords", "word"],
    ["nativeMeanings", "meaning"],
    ["nativeWordPOS", "pos"],
    ["nativeWordContexts", "context"],
    ["nativeDistractA", "a"],
    ["nativeDistractB", "b"],
    ["nativeAliases", "aliases"],
    ["nativeSenseRevisions", "revision"],
  ];
  const lines = ["func initNativeWordData() {", `nativeCoreBank=${core}`];
  for (const [name, key] of columns) {
    const values = rows.map((row) => row[key]);
    if (values.some((v) => typeof v !== "string" || v.includes(separator)))
      throw new Error("Invalid packed word field: " + key);
    lines.push(
      `${name}=strings.Split(${quote(values.join(separator))},${quote(separator)})`,
    );
  }
  for (const [name, key] of [
    ["nativeLevels", "level"],
    ["nativeSpellable", "spell"],
    ["nativeLegacySenseSafe", "legacySafe"],
  ]) {
    const values = rows.map((row) => row[key]);
    if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 9))
      throw new Error("Invalid packed word flag: " + key);
    lines.push(
      `${name}=make([]int,${rows.length}); for i,c := range ${quote(values.join(""))} {${name}[i]=int(c-'0')}`,
    );
  }
  lines.push("}", "func initNativeGlyphData() {", "n:=0");
  for (const [font, name] of [
    "nativeGlyphs",
    "nativeSerifGlyphs",
    "nativeMonoGlyphs",
    "nativeErrorGlyphs",
  ].entries()) {
    const group = entries
      .map((entry, index) => ({ ...entry, index }))
      .filter((entry) => entry.font === font);
    if (
      !group.length ||
      group.some(
        (entry, i) =>
          entry.index !== group[0].index + i ||
          Array.from(entry.c).length !== 1,
      )
    )
      throw new Error("Noncontiguous glyph group: " + name);
    lines.push(
      `${name}=map[rune]int{}; n=${group[0].index}; for _,c := range ${quote(group.map((entry) => entry.c).join(""))} {${name}[c]=n; n++}`,
    );
  }
  if (entries.length !== glyphs.length)
    throw new Error("Glyph metrics count mismatch");
  const metrics = glyphs
    .map(({ advance }) => {
      const value = Math.round(Number(advance.toFixed(5)) * 100000);
      if (!Number.isFinite(value) || value < 0 || value > 999999)
        throw new Error("Invalid glyph advance");
      return String(value).padStart(6, "0");
    })
    .join("");
  lines.push(
    `nativeGlyphAdvance=make([]float64,${glyphs.length}); for i,c := range ${quote(metrics)} {n=i/6; nativeGlyphAdvance[n]=nativeGlyphAdvance[n]*10+float64(c-'0')}; for i:=0;i<len(nativeGlyphAdvance);i++ {nativeGlyphAdvance[i]/=100000}`,
    "}",
  );
  return lines.join("\n") + "\n";
}
