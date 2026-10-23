import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const module = source.slice(source.indexOf("// Dealing range adaptation:"), source.indexOf("alertcondition(alertFlip"));

test("full dealing range is isolated and adds no plots to the RSI pane", () => {
  for (const group of ["DR | Range", "DR | FVG / IFVG", "DR | Order blocks",
    "DR | Breaker blocks", "DR | Style / retention"]) {
    assert.ok(module.includes(`"${group}"`), group);
  }
  assert.match(module, /drx_enabled = input\.bool\(true/);
  assert.doesNotMatch(module, /\b(?:plot|plotshape|alertcondition|indicator)\s*\(/);
  for (const line of module.split("\n").filter(line => /\b(?:box|line)\.new\(/.test(line))) {
    assert.ok(line.includes("force_overlay = true"), line);
  }
  for (const label of ["OB+", "OB-", "BB+", "BB-", "FVG+", "FVG-", "IFVG+", "IFVG-"]) {
    assert.ok(module.includes(`"${label}"`), label);
  }
});

test("range, pivots, gap inversion and close-based mitigation retain source rules", () => {
  assert.match(module, /ta\.highest\(high, drx_drBars\)/);
  assert.match(module, /ta\.lowest\s*\(low,\s*drx_drBars\)/);
  assert.match(module, /if barstate\.islast and drx_enabled/);
  assert.match(module, /if drx_enabled and barstate\.isconfirmed/);
  assert.match(module, /ta\.pivothigh\(high, drx_pivLen, drx_pivLen\)/);
  assert.match(module, /r\.dir > 0 \? close < r\.lo : close > r\.hi/);
  assert.equal([...module.matchAll(/r\.alive and r\.kind == "FVG" and close/g)].length, 2);
  assert.match(module, /drx_sweepGroup\(drx_bbBull,\s*drx_bbUp,\s*drx_bbExt,\s*true,\s*drx_bbAge\)/);
});

test("empty history and faded zone ownership are guarded and bounded", () => {
  assert.match(module, /if n >= 1\s+for k = 1 to n/);
  assert.match(module, /if bag\.size\(\) > drx_perKind\s+drx_Region drop = bag\.pop\(\)\s+box\.delete\(drop\.shape\)/);
  assert.match(module, /drx_killRegion\(r, paint\)\s+if not drx_keepDead\s+bag\.remove\(i\)/);
  assert.match(module, /if drx_highs\.size\(\) >= 2/);
  assert.match(module, /if drx_lows\.size\(\) >= 2/);
});
