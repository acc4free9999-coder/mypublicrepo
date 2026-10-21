import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const zone = (bars, cur, atr = 1, o = { impulse: 1.5, base: 0.6, maxBase: 3 }) => {
  let n = 0;
  for (const b of bars) { if (Math.abs(b.c - b.o) <= o.base * atr && n < o.maxBase) n++; else break; }
  if (!n || Math.abs(cur.c - cur.o) < o.impulse * atr) return null;
  const base = bars.slice(0, n);
  const hi = Math.max(...base.map((b) => b.h)), lo = Math.min(...base.map((b) => b.l));
  if (cur.c > cur.o && cur.c > hi) return { dir: 1, top: Math.max(...base.map((b) => Math.max(b.o, b.c))), bottom: lo };
  if (cur.c < cur.o && cur.c < lo) return { dir: -1, top: hi, bottom: Math.min(...base.map((b) => Math.min(b.o, b.c))) };
  return null;
};
const bar = (o, h, l, c) => ({ o, h, l, c });

test("demand and supply zones require base plus displacement beyond base", () => {
  const base = [bar(10, 10.4, 9.8, 10.1), bar(10.2, 10.5, 9.9, 10)];
  assert.deepEqual(zone(base, bar(10, 12.5, 10, 12.4)), { dir: 1, top: 10.2, bottom: 9.8 });
  assert.deepEqual(zone(base, bar(10, 10, 7.5, 7.6)), { dir: -1, top: 10.5, bottom: 10 });
  assert.equal(zone(base, bar(10, 11, 9.9, 10.9)), null);
  assert.equal(zone([bar(10, 13, 9, 12)], bar(12, 15, 12, 14.9)), null);
});

test("source: confirmed-only creation, mitigation first, bounded boxes, no requests", () => {
  const block = source.slice(source.indexOf("var array<box> sdBoxes"), source.indexOf("// Optional overlays use chart OHLC"));
  assert.match(block, /if sdEnabled and barstate\.isconfirmed/);
  assert.ok(block.indexOf("bool broken") < block.indexOf("int newDir"));
  assert.match(block, /box\.delete\(array\.shift\(sdBoxes\)\)/);
  assert.match(block, /extend = extend\.right/);
  assert.doesNotMatch(block, /request\./);
  assert.match(source, /max_boxes_count = 100/);
  assert.match(source, /sdMaxZones = input\.int\(10, "Maximum active zones", minval = 2, maxval = 40/);
  assert.match(source, /bool sdEnabled = input\.bool\(false/);
});

test("zone overlap loop is guarded against empty arrays", () => {
  assert.match(source, /if zoneCount > 0\s+for i = 0 to zoneCount - 1/);
  assert.doesNotMatch(source, /for i = 0 to array\.size\(sdBoxes\) - 1/);
});

test("no negative loop steps (Pine requires step > 0)", () => {
  assert.doesNotMatch(source, /\bby\s+-\d/);
});
