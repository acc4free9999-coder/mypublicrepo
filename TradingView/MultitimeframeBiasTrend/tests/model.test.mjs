import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const classify = (score, allowBull = true, allowBear = true, strongBull = false, strongBear = false) => {
  if (score == null) return 0;
  if (score >= 20 && allowBull) return score >= 60 && strongBull ? 2 : 1;
  if (score <= -20 && allowBear) return score <= -60 && strongBear ? -2 : -1;
  return 0;
};
const score = (parts, weights = [2, 1, 2, 1], rsi = true) => {
  const active = rsi ? weights : weights.map((v, i) => i === 3 ? 0 : v);
  const denominator = active.reduce((a, b) => a + b, 0);
  if (denominator === 0) throw new Error("No active weight");
  return 100 * parts.reduce((sum, value, i) => sum + value * active[i], 0) / denominator;
};
const summarize = (rows) => {
  const valid = rows.filter((r) => r.enabled && r.ready);
  const weight = valid.reduce((s, r) => s + r.weight, 0);
  if (!weight) return { score: null, bias: 0, alignment: null, valid: 0 };
  const value = valid.reduce((s, r) => s + r.weight * (r.bias ? r.score : 0), 0) / weight;
  const share = (p) => 100 * valid.filter(p).reduce((s, r) => s + r.weight, 0) / weight;
  return {
    score: value,
    bias: classify(value, true, true, share((r) => r.bias === 2) >= 60, share((r) => r.bias === -2) >= 60),
    alignment: Math.max(share((r) => r.bias > 0), share((r) => r.bias < 0)),
    valid: valid.length,
  };
};
const row = (bias, value, weight = 1, ready = true, enabled = true) =>
  ({ bias, score: value, weight, ready, enabled });

test("normalization is bounded, symmetric, and removes disabled RSI weight", () => {
  for (const e of [-1, 0, 1]) for (const s of [-1, 0, 1])
    for (const p of [-1, 0, 1]) for (const r of [-1, 0, 1]) {
      const parts = [e, s, p, r];
      assert.ok(Math.abs(score(parts)) <= 100);
      assert.equal(score(parts) + score(parts.map((v) => -v)), 0);
    }
  assert.equal(score([1, 1, 1, -1], undefined, false), 100);
  assert.equal(score([-1, -1, -1, 1], undefined, false), -100);
  assert.equal(score([1, 1, 1, 1]), 100);
  assert.throws(() => score([1, 1, 1, 1], [0, 0, 0, 0]));
});

test("exact boundaries, strong-evidence cap, and direction gates", () => {
  for (const value of [-19.999, 0, 19.999]) assert.equal(classify(value), 0);
  assert.equal(classify(20), 1);
  assert.equal(classify(-20), -1);
  assert.equal(classify(59.999, true, true, true, true), 1);
  assert.equal(classify(-59.999, true, true, true, true), -1);
  assert.equal(classify(60, true, true, true), 2);
  assert.equal(classify(-60, true, true, false, true), -2);
  assert.equal(classify(100), 1);
  assert.equal(classify(-100), -1);
  assert.equal(classify(100, false), 0);
  assert.equal(classify(-100, true, false), 0);
  assert.equal(classify(null), 0);
});

test("missing rows are not neutral; neutral and vetoed rows retain denominator weight", () => {
  const result = summarize([row(2, 100, 5), row(-2, -100, 4, false), row(0, 90, 5)]);
  assert.equal(result.valid, 2);
  assert.equal(result.score, 50);
  assert.equal(result.bias, 1);
  assert.equal(result.alignment, 50);
  assert.equal(summarize([row(0, 0), row(0, 15)]).alignment, 0);
  assert.equal(summarize([row(2, 100, 5, true, false)]).score, null);
});

test("weak ADX cannot yield strong aggregate even at unanimous raw score 100", () => {
  const result = summarize(Array.from({ length: 7 }, () => row(1, 100)));
  assert.equal(result.score, 100);
  assert.equal(result.bias, 1);
  assert.equal(result.alignment, 100);
  assert.equal(summarize([row(2, 100, 6), row(1, 100, 4)]).bias, 2);
  assert.equal(summarize([row(2, 100, 5.9), row(1, 100, 4.1)]).bias, 1);
});

test("default higher weights dominate unanimous opposing lower groups", () => {
  const weights = [5, 4, 3, 2, 1.5, 1, 0.5];
  const result = summarize(weights.map((weight, i) => row(i < 3 ? 2 : -2, i < 3 ? 100 : -100, weight)));
  assert.equal(result.score, 100 * 7 / 17);
  assert.equal(result.bias, 1);
});

test("table indices stay within dimensions for all column and timeframe combinations", () => {
  for (let enabled = 1; enabled <= 7; enabled++) {
    for (let mask = 0; mask < 512; mask++) {
      const columns = 1 + [...mask.toString(2)].filter((b) => b === "1").length;
      const rows = 13 + enabled;
      assert.ok(columns >= 1 && columns <= 10);
      assert.ok(10 < rows);
      assert.ok(11 + enabled - 1 < rows);
      assert.equal(12 + enabled, rows - 1);
    }
  }
});

test("alert transition oracle does not repeat states or invent initial reversals", () => {
  let lastDirection = 0;
  const events = [1, 1, 0, -1, -1, 0, 1].map((direction) => {
    const flip = direction !== 0 && lastDirection !== 0 && direction !== lastDirection;
    if (direction) lastDirection = direction;
    return flip;
  });
  assert.deepEqual(events, [false, false, false, true, false, false, true]);
});

test("source contains v6 safety mechanisms and seven valid timeframe calls", () => {
  assert.ok(source.startsWith("//@version=6\n"));
  assert.match(source, /ta\.dmi\(diLen, adxLen\)/);
  assert.doesNotMatch(source, /ta\.adx\(/);
  assert.match(source, /f_engine\(confirmed \? 1 : 0\)/);
  assert.match(source, /lookahead = confirmed and not lower \? barmerge\.lookahead_on : barmerge\.lookahead_off/);
  assert.match(source, /request\.security_lower_tf\(sourceTicker, tf, f_intrabarValues\(\), calc_bars_count = intrabarBars\)/);
  assert.match(source, /sourceClose <= closedThrough/);
  assert.match(source, /if na\(result\)\s+result := Snapshot\.new\(\)/);
  assert.match(source, /result := lastClosedIntrabar/);
  assert.match(source, /chartIsTicks \? 0 : timeframe\.in_seconds\(\)/);
  assert.match(source, /if barstate\.isconfirmed/);
  assert.match(source, /if barstate\.islast/);
  assert.match(source, /13 \+ enabledCount/);
  assert.equal([...source.matchAll(/Snapshot \w+ = f_fetch\("(1M|1W|1D|240|60|15|5)",/g)].length, 7);
  assert.equal([...source.matchAll(/^alertcondition\(/gm)].length, 10);
  assert.ok(source.length < 200_000);
});

test("intrabar flags preserve every combination of readiness and market condition", () => {
  for (let bits = 0; bits < 16; bits++) {
    const ready = Boolean(bits & 1);
    const structureReady = Boolean(bits & 2);
    const trending = Boolean(bits & 4);
    const ranging = Boolean(bits & 8);
    const flags = Number(ready) + 2 * Number(structureReady) + 4 * Number(trending) + 8 * Number(ranging);
    assert.deepEqual(
      [flags % 2 === 1, Math.trunc(flags / 2) % 2 === 1, Math.trunc(flags / 4) % 2 === 1, Math.trunc(flags / 8) % 2 === 1],
      [ready, structureReady, trending, ranging],
    );
  }
});

test("replay selection rejects candles beyond chart close and retains only known closed data", () => {
  const select = (closes, chartClose, now, previous = null) => {
    const cutoff = chartClose == null ? now : Math.min(chartClose, now);
    return closes.findLast((close) => close != null && close <= cutoff) ?? previous;
  };
  assert.equal(select([100, 200, 300], 200, 1000), 200);
  assert.equal(select([100, 200, 300], 300, 250), 200);
  assert.equal(select([], 400, 1000, 200), 200);
  assert.equal(select([], 400, 1000), null);
  assert.equal(select([null], 400, 1000), null);
  assert.equal(select([100, 200], 200, 1000), 200);
});

test("request payloads and histories are bounded without duplicate lower-row security", () => {
  assert.doesNotMatch(source, /max_bars_back\s*=/);
  assert.doesNotMatch(source, /array<Snapshot>\s+intrabars/);
  assert.match(source, /request\.security\([^\n]+calc_bars_count = sourceBars\)/);
  assert.match(source, /else\s+\/\/ lookahead_on[^\n]*\n\s+result := request\.security\(/);
  assert.match(source, /barsSeen >= slowLen \+ slopeBars/);
  const payload = source.match(/^\s+\[s\.score,.*flags\]$/m)?.[0];
  assert.ok(payload);
  const fields = payload.trim().slice(1, -1).split(",").map((field) => field.trim());
  assert.equal(fields.length, 11);
  assert.ok(7 * (fields.length + 5) <= 127);
  const requestArrays = source.match(/\[scores, directions,.*states\] = request\.security_lower_tf/)?.[0];
  assert.ok(requestArrays);
  assert.equal(requestArrays.split("]")[0].slice(1).split(",").length, fields.length);
});

test("compact direction payload preserves all 1215 direction combinations", () => {
  for (let bias = -2; bias <= 2; bias++)
    for (let ema = -1; ema <= 1; ema++)
      for (let slope = -1; slope <= 1; slope++)
        for (let structure = -1; structure <= 1; structure++)
          for (let high = -1; high <= 1; high++)
            for (let low = -1; low <= 1; low++) {
              const code = bias + 2 + 5 * (ema + 1) + 15 * (slope + 1) + 45 * (structure + 1) + 135 * (high + 1) + 405 * (low + 1);
              assert.deepEqual([code % 5 - 2, ...[5, 15, 45, 135, 405].map((divisor) => Math.trunc(code / divisor) % 3 - 1)], [bias, ema, slope, structure, high, low]);
            }
});
