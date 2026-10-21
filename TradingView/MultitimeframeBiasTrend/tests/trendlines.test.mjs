import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");

test("trendlines have per-timeframe toggles and colors", () => {
  for (const tf of ["M", "W", "D", "4H", "1H", "15", "5"]) {
    assert.match(source, new RegExp(`bool tlOn${tf} = input\\.bool`));
    assert.match(source, new RegExp(`color tlColor${tf} = input\\.color`));
  }
});

test("trendlines are LuxAlgo-style sloped lines, hidden on higher charts", () => {
  assert.match(source, /if ewOn or tlOn/);
  assert.match(source, /max_lines_count = 500/);
  assert.match(source, /state\.atrHigh \/ tlLength \* tlMult/);
  assert.match(source, /state\.atrLow \/ tlLength \* tlMult/);
  assert.match(source, /timeframe\.in_seconds\(array\.get\(tfs, tfIndex\)\) >= chartSeconds/);
  assert.doesNotMatch(source, /\bby\s+-\d/);
  assert.doesNotMatch(source, /line\.style [a-z]/);
});
