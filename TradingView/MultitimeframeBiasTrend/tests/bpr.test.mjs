import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const module = source.slice(source.indexOf("// BPR adaptation"), source.indexOf("alertcondition(alertFlip"));

test("BPR replaces the old detector with independent reference settings and latest gaps", () => {
  assert.doesNotMatch(source, /drx_bpr|drx_gapBullHistory|drx_findBpr|drx_rememberGap/);
  assert.match(source, /bprSensitivity = input\.int\(2,/);
  assert.match(source, /bprShowMitigated = input\.bool\(true,/);
  assert.match(source, /bprShowMidpoint = input\.bool\(true,/);
  assert.match(module, /ta\.atr\(20\)/);
  assert.match(module, /bprBody\[1\] > \(bprBody \+ bprBody\[2\]\) \* 0\.3/);
  assert.match(module, /bprMinimum = bprAtr \* bprSensitivity \* 0\.08/);
  assert.match(module, /low\[2\] - high > bprMinimum/);
  assert.match(module, /low - high\[2\] > bprMinimum/);
  assert.match(module, /if bprEnabled and barstate\.isconfirmed/);
  assert.doesNotMatch(module, /drx_enabled|drx_fvgDR|drx_perKind|request\.|alertcondition\(/);
});

test("BPR owns at most one box and midpoint per side and latches mitigation", () => {
  assert.match(module, /previous\.shape\.delete\(\)/);
  assert.match(module, /previous\.midline\.delete\(\)/);
  assert.match(module, /if not na\(zone\) and zone\.active/);
  assert.match(module, /zone\.active := false/);
  assert.match(module, /math\.min\(open, close\) : math\.max\(open, close\)/);
  assert.match(module, /bodyEdge < boundary : bodyEdge > boundary/);
  assert.match(module, /zone\.shape\.set_right\(time\)/);
  assert.match(module, /color\.new\(paint, 95\)/);
  assert.equal([...module.matchAll(/alert\(/g)].length, 4);
  for (const line of module.split("\n").filter(line => /\b(?:box|line)\.new\(/.test(line))) {
    assert.ok(line.includes("force_overlay = true"), line);
    assert.ok(line.includes("xloc=xloc.bar_time"), line);
  }
});

const overlap = (older, newer) => {
  const hi = Math.min(older.hi, newer.hi);
  const lo = Math.max(older.lo, newer.lo);
  return hi > lo ? { hi, lo } : null;
};

test("gap intersection requires positive width and mirrors for bull/bear", () => {
  assert.deepEqual(overlap({ hi: 108, lo: 102 }, { hi: 110, lo: 105 }), { hi: 108, lo: 105 });
  assert.deepEqual(overlap({ hi: 110, lo: 105 }, { hi: 108, lo: 102 }), { hi: 108, lo: 105 });
  assert.equal(overlap({ hi: 105, lo: 100 }, { hi: 110, lo: 105 }), null);
  assert.equal(overlap({ hi: 104, lo: 100 }, { hi: 110, lo: 105 }), null);
  assert.equal([...module.matchAll(/if sourceCondition and hi > lo/g)].length, 2);
  assert.match(module, /math\.min\(bprLastBear\.hi, low\)/);
  assert.match(module, /math\.max\(bprLastBear\.lo, high\[2\]\)/);
  assert.match(module, /math\.min\(bprLastBull\.hi, low\[2\]\)/);
  assert.match(module, /math\.max\(bprLastBull\.lo, high\)/);
});
