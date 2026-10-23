import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const module = source.slice(source.indexOf("// Sideways boundaries"), source.indexOf("// RSI is applied"));

test("sideways selector includes five detectors and both combination modes", () => {
  for (const method of ["ADX", "Bollinger Band Width", "ATR-normalized range",
    "EMA compression", "Choppiness Index", "All methods", "Any method"]) {
    assert.ok(source.includes(`"${method}"`), method);
  }
  assert.match(module, /"All methods" => sideAdxOk and sideBbOk and sideRangeOk and sideEmaOk and sideChopOk/);
  assert.match(module, /=> sideAdxOk or sideBbOk or sideRangeOk or sideEmaOk or sideChopOk/);
});

test("sideways metrics guard missing data and use exact threshold boundaries", () => {
  assert.match(module, /sideAtr > 0/);
  assert.match(module, /sideAdx <= sideAdxMax/);
  assert.match(module, /sideBbWidth <= sideBbMax/);
  assert.match(module, /sideSpan \/ sideAtr <= sideRangeMax/);
  assert.match(module, /sideChop >= sideChopMin/);
  assert.match(module, /400 \* sideDeviation \/ math\.abs\(sideBasis\)/);
  assert.match(module, /math\.sum\(ta\.tr\(true\), sideLength\)/);
  assert.match(module, /sideSpan == 0 \? 100/);
});

test("boxes confirm at close, freeze boundaries, exclude exit candle and remain bounded", () => {
  assert.match(module, /if sideEnabled and barstate\.isconfirmed/);
  assert.match(module, /else if sideStreak >= sideConfirm/);
  assert.match(module, /close > sideTop or close < sideBottom/);
  assert.match(module, /if sideBreakout or not sideQualifies/);
  assert.match(module, /sideBox\.set_right\(bar_index - 1\)/);
  assert.match(module, /sideBox := na\s+sideStreak := 0/);
  assert.match(module, /else if sideStreak >= sideConfirm\s+sideTop := sideHigh\s+sideBottom := sideLow/);
  assert.match(module, /while sideBoxes\.size\(\) > sideKeep\s+sideBoxes\.shift\(\)\.delete\(\)/);
  assert.match(module, /box\.new\([^\n]+force_overlay = true/);
  assert.doesNotMatch(module, /\b(?:plot|plotshape|request\.security|alertcondition)\(/);
});
