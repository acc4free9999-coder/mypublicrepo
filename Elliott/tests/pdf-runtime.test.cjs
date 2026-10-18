const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/core.js");
const { rsiValues } = require("../assets/pdf-practice.js");

function fixture() {
  const prices = [2300, 2340, 2320, 2390, 2350, 2410];
  const bars = prices.map((price, index) => ({
    date: `2024-01-${String(index + 1).padStart(2, "0")} 00:00:00`,
    open: price, high: price, low: price, close: price
  }));
  return { id: "pdf-unit-test-window", symbol: "XAUUSDm", timeframe: "H4", source: "synthetic-test-only", timezone: "unknown", curriculum: "xauusd-pdf-v1", unitTitle: "Rule audit", bars };
}

test("legacy defaults stay unchanged while PDF backups require the PDF dataset", () => {
  assert.deepEqual(core.emptyWorkbook(), { schema: 3, dataset: "xauusd-roadmap-v3", days: {} });
  const pdf = core.emptyWorkbook("xauusd-pdf-v1");
  assert.throws(() => core.validateWorkbook(pdf, {}), /matching curriculum/);
  assert.throws(() => core.validateWorkbook(core.emptyWorkbook(), {}, "xauusd-pdf-v1"), /matching curriculum/);
  assert.deepEqual(core.validateWorkbook(pdf, {}, "xauusd-pdf-v1"), pdf);
  assert.throws(() => core.emptyWorkbook("unknown"), /Unknown curriculum/);
});

test("quiz selections, Vietnamese review text and complete WXYXZ labels round-trip", () => {
  const window = fixture();
  const workbook = core.emptyWorkbook("xauusd-pdf-v1");
  workbook.days[16] = {
    ...core.initialDay(window),
    mode: "swings",
    answers: { 1: "Chưa đủ bằng chứng / Unverified", 7: "Giữ bản vẽ gốc." },
    marks: ["0", "W", "X", "Y", "X2", "Z"].map((label, index) => ({ label, index, anchor: index % 2 ? "high" : "low" }))
  };
  assert.deepEqual(core.validateWorkbook(JSON.parse(JSON.stringify(workbook)), { 16: window }, "xauusd-pdf-v1"), workbook);
  const stale = { ...window, id: "different-window" };
  assert.throws(() => core.validateWorkbook(workbook, { 16: stale }, "xauusd-pdf-v1"), /window has changed/);
});

test("PDF response validation rejects nontext, oversized and out-of-range answers", () => {
  const window = fixture();
  const base = { ...core.emptyWorkbook("xauusd-pdf-v1"), days: { 1: core.initialDay(window) } };
  for (const answers of [[], null, { 1: false }, { 1: "x".repeat(12001) }, { 51: "wrong key" }]) {
    const workbook = JSON.parse(JSON.stringify(base));
    workbook.days[1].answers = answers;
    assert.throws(() => core.validateWorkbook(workbook, { 1: window }, "xauusd-pdf-v1"), /response/i);
  }
  assert.deepEqual(core.validateWorkbook(base, { 1: window }, "xauusd-pdf-v1"), base);
});

test("review packets name the PDF unit and never expose hidden practice candles", () => {
  const window = fixture();
  window.questions = [{ prompt: "Audit this wave", options: ["Invalid", "Unverified", "Certain"], correct: 1, explanation: "Internals still require review." }];
  const state = { ...core.initialDay(window), cursor: 4, answers: { 1: "Unverified", 7: "Origin retained." } };
  const packet = core.reviewPacket(window, 4, state);
  assert.equal(packet.curriculum, "xauusd-pdf-v1");
  assert.equal(packet.unitTitle, window.unitTitle);
  assert.equal(packet.visibleBars.length, 4);
  assert.equal(packet.cutoff, window.bars[3].date);
  assert.equal(packet.quizReview[0].selectedAnswer, "Unverified");
  assert.equal(packet.answers[7], "Origin retained.");
});

test("drawing rule checks still reject overlap without certifying a passing candidate", () => {
  const window = fixture();
  const marks = window.bars.map((bar, index) => ({ index, label: String(index), anchor: index % 2 ? "high" : "low" }));
  const accepted = core.checkCount(window.bars, 6, marks, "impulse");
  assert.ok(!accepted.findings.some((finding) => finding.level === "error"));
  assert.ok(accepted.findings.some((finding) => /not AI certification/.test(finding.message)));
  const overlap = structuredClone(window.bars);
  overlap[4] = { ...overlap[4], open: 2335, high: 2335, low: 2335, close: 2335 };
  assert.ok(core.checkCount(overlap, 6, marks, "impulse").findings.some((finding) => finding.level === "error" && /overlap/.test(finding.message)));
});

test("Wilder RSI remains prefix-stable and handles flat, rising and falling sequences", () => {
  for (const [closes, expected] of [
    [Array(40).fill(5), 50],
    [Array.from({ length: 40 }, (_, i) => i), 100],
    [Array.from({ length: 40 }, (_, i) => 40 - i), 0]
  ]) assert.equal(rsiValues(closes).at(-1), expected);
  const mixed = Array.from({ length: 80 }, (_, i) => 2000 + i + (i % 3 ? 8 : -8));
  assert.deepEqual(rsiValues(mixed).slice(0, 40), rsiValues(mixed.slice(0, 40)));
  assert.ok(rsiValues(mixed).every((value) => value === null || value >= 0 && value <= 100));
  assert.throws(() => rsiValues([1, Infinity]), /finite/);
});
