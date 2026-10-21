import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const normalized = (points) => {
  const direction = Math.sign(points[1] - points[0]);
  return points.map((p) => direction * (p - points[0]));
};
const motive = (points, diagonal = false) => {
  const [, p1, p2, p3, p4, p5] = normalized(points);
  const w1 = p1, w3 = p3 - p2, w5 = p5 - p4;
  const base = p1 > 0 && p2 > 0 && p2 < p1 && p3 > p1 && p4 > p2 && p4 < p3 && p5 > p4;
  if (!base) return "";
  if (!diagonal && p4 > p1 && w3 >= Math.min(w1, w5)) {
    if (p5 <= p3) return "Impulse: truncated 5";
    if (w3 > 1.618 * Math.max(w1, w5)) return "Impulse: extended 3";
    if (w1 > 1.618 * Math.max(w3, w5)) return "Impulse: extended 1";
    if (w5 > 1.618 * Math.max(w1, w3)) return "Impulse: extended 5";
    return "Impulse";
  }
  if (diagonal && p4 < p1 && p5 > p3) {
    const w2 = p1 - p2, w4 = p3 - p4;
    if (w1 > w3 && w3 > w5 && w2 > w4) return "Contracting diagonal";
    if (w1 < w3 && w3 < w5 && w2 < w4) return "Expanding diagonal";
  }
  return "";
};
const correction = (points, equality = 0.03) => {
  const [, a, b, c] = normalized(points);
  const retrace = a > 0 ? (a - b) / a : NaN;
  const tolerance = a * equality;
  if (a > 0 && retrace > 0) {
    if (retrace < 0.9 && b > 0 && c > a) return "Zigzag";
    if (retrace >= 0.9 && retrace <= 1.1 && Math.abs(c - a) <= tolerance) return "Regular flat";
    if (retrace > 1 && c > a + tolerance) return "Expanded flat";
    if (retrace > 1 && c > b && c < a - tolerance) return "Running flat";
  }
  return "";
};
const triangle = (points, equality = 0.03) => {
  const [, a, b, c, d, e] = normalized(points);
  const tolerance = a * equality;
  if (!(a > 0 && b < a && c > b && d < c && e > d)) return "";
  if (b > 0 && c < a - tolerance && d > b + tolerance && e < c) return "Contracting triangle";
  if (b > 0 && Math.abs(c - a) <= tolerance && d > b + tolerance && e <= c + tolerance) return "Barrier triangle";
  if (b > 0 && c < a - tolerance && Math.abs(d - b) <= tolerance && e < c) return "Barrier triangle";
  if (c > a + tolerance && d < b - tolerance && e > c) return "Expanding triangle";
  return "";
};
const combination = (points, components) =>
  Array.from({ length: components }, (_, i) => correction(points.slice(i * 3, i * 3 + 4))).every(Boolean);
const mirror = (points) => points.map((p) => 100 - p);

test("impulse, extended legs and truncated fifth mirror in both directions", () => {
  for (const [points, expected] of [
    [[0, 10, 4, 20, 12, 23], "Impulse"],
    [[0, 10, 4, 30, 20, 32], "Impulse: extended 3"],
    [[0, 40, 30, 45, 42, 50], "Impulse: extended 1"],
    [[0, 10, 4, 20, 12, 42], "Impulse: extended 5"],
    [[0, 10, 4, 22, 12, 20], "Impulse: truncated 5"],
  ]) {
    assert.equal(motive(points), expected);
    assert.equal(motive(mirror(points)), expected);
  }
});

test("hard impulse violations never produce an impulse", () => {
  for (const points of [
    [0, 10, -1, 20, 12, 23],
    [0, 10, 4, 9, 7, 15],
    [0, 10, 4, 20, 8, 23],
    [0, 10, 8, 15, 11, 21],
    [0, 10, 4, 22, 12, 12],
  ]) assert.equal(motive(points), "");
});

test("overlapping diagonals are distinct from impulse and require monotonic leg lengths", () => {
  for (const [points, expected] of [
    [[0, 10, 4, 12, 7, 13], "Contracting diagonal"],
    [[0, 6, 2, 10, 4, 14], "Expanding diagonal"],
  ]) {
    assert.equal(motive(points, true), expected);
    assert.equal(motive(mirror(points), true), expected);
    assert.equal(motive(points), "");
  }
  assert.equal(motive([0, 10, 4, 12, 7, 20], true), "");
});

test("ABC classifier distinguishes zigzag and three flat geometries symmetrically", () => {
  for (const [points, expected] of [
    [[0, 10, 5, 15], "Zigzag"],
    [[0, 10, 0.5, 10], "Regular flat"],
    [[0, 10, -2, 13], "Expanded flat"],
    [[0, 10, -2, 8], "Running flat"],
  ]) {
    assert.equal(correction(points), expected);
    assert.equal(correction(mirror(points)), expected);
  }
  assert.equal(correction([0, 10, 5, 8]), "");
  assert.equal(correction([0, 0, 0, 0]), "");
  assert.equal(correction([0, 10, 12, 15]), "");
});

test("triangles include both barrier orientations and expanding boundaries", () => {
  for (const [points, expected] of [
    [[0, 10, 2, 8, 4, 6], "Contracting triangle"],
    [[0, 10, 2, 10, 4, 8], "Barrier triangle"],
    [[0, 10, 2, 8, 2, 6], "Barrier triangle"],
    [[0, 10, -2, 12, -4, 14], "Expanding triangle"],
  ]) {
    assert.equal(triangle(points), expected);
    assert.equal(triangle(mirror(points)), expected);
  }
  assert.equal(triangle([0, 10, 2, 8, 9, 6]), "");
  assert.equal(triangle([0, 10, -2, 8, 4, 6]), "");
});

test("WXY and WXYXZ require each ABC component, not merely many pivots", () => {
  const points = [0, 10, 5, 15, 5, 10, 0, 10, 5, 15, 5, 10, 0, 10, 5, 15];
  assert.equal(combination(points.slice(0, 10), 3), true);
  assert.equal(combination(points, 5), true);
  assert.equal(combination(mirror(points), 5), true);
  const invalid = [...points];
  invalid[8] = 12;
  assert.equal(combination(invalid, 5), false);
});

test("intrabar events are processed in order, deduplicated and isolated per timeframe", () => {
  const states = Array.from({ length: 7 }, () => ({ seen: null, stamps: [] }));
  const accept = (index, events, cutoff) => {
    const state = states[index];
    for (const event of events) {
      if (event.close <= cutoff && (state.seen === null || event.close > state.seen)) {
        state.seen = event.close;
        if (event.kind) state.stamps.push(event.stamp);
      }
    }
  };
  const events = [{ close: 10, stamp: 5, kind: 1 }, { close: 20, stamp: 15, kind: -1 }, { close: 30, stamp: 25, kind: 1 }];
  accept(6, events, 20);
  accept(6, events, 30);
  assert.deepEqual(states[6].stamps, [5, 15, 25]);
  assert.deepEqual(states[0].stamps, []);
  accept(0, [events[0]], 10);
  assert.deepEqual(states[0].stamps, [5]);
  accept(6, [], 40);
  assert.equal(states[6].seen, 30);
});

test("pivot ingestion replaces extremes, filters reversals, and caps storage", () => {
  const pivots = [];
  const ingest = (price, time, kind, minimum = 2) => {
    const last = pivots.at(-1);
    if (!last) pivots.push({ price, time, kind });
    else if (time > last.time) {
      if (kind === last.kind) {
        if (kind * (price - last.price) <= 0) return false;
        pivots[pivots.length - 1] = { price, time, kind };
      } else {
        if (!(kind * (price - last.price) >= minimum && kind * (price - last.price) > 0)) return false;
        pivots.push({ price, time, kind });
        if (pivots.length > 32) pivots.shift();
      }
    } else return false;
    return true;
  };
  assert.equal(ingest(0, 0, -1), true);
  assert.equal(ingest(1, 1, 1), false);
  assert.equal(ingest(10, 2, 1), true);
  assert.equal(ingest(9, 3, 1), false);
  assert.equal(ingest(12, 4, 1), true);
  assert.equal(pivots.length, 2);
  assert.equal(pivots.at(-1).price, 12);
  assert.equal(ingest(14, 4, 1), false);
  assert.equal(ingest(12, 5, -1, 0), false);
  for (let i = 0; i < 100; i++) {
    assert.equal(ingest(i % 2 === 0 ? 0 : 12, 10 + i, i % 2 === 0 ? -1 : 1), true);
  }
  assert.equal(pivots.length, 32);
  assert.equal(pivots.at(-1).time, 109);
});
test("Elliott is the adapted elliott.pine zigzag engine on the chart timeframe", () => {
  const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
  assert.match(source, /^f_ewZigzag\(bool enabled, int left, color col, int n\) =>/m);
  assert.match(source, /f_ewZigzag\(ewEnabled and ewOn1, ewLen1, ewCol1, 0\)/);
  assert.match(source, /f_ewZigzag\(ewEnabled and ewOn3, ewLen3, ewCol3, 2\)/);
  assert.match(source, /_break_   =   false/);
  assert.doesNotMatch(source, /WaveState|f_ewFetch/);
});
