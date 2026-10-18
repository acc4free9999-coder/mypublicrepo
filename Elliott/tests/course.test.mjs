import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { lessons, stages } from "../course.mjs";
import { escape } from "../scripts/build.mjs";
import { parseMt5, loadWindows } from "../scripts/mt5.mjs";
import { teachingUnits, validateTeaching } from "../teaching/index.mjs";
import { diagramSvg, figureName } from "../scripts/teaching-html.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = createRequire(import.meta.url)("../assets/core.js");
const context = {};
vm.runInNewContext(readFileSync(resolve(root, "assets/chart-data.js"), "utf8"), context);
const data = JSON.parse(JSON.stringify(context.ElliottData));
const windows = data.windowsByDay;
const synthetic = (prices) => prices.map((price, i) => ({ date: `2024-01-${String(i + 1).padStart(2, "0")} 00:00:00`, open: price, high: price + 1, low: price - 1, close: price }));
function impulse(prices, bearish = false) {
  const bars = synthetic(prices);
  const marks = prices.map((price, i) => {
    const anchor = (i % 2 === 0) !== bearish ? "low" : "high";
    bars[i][anchor] = price;
    return { index: i, label: String(i), anchor };
  });
  return { bars, marks };
}
const hasError = (report, text) => report.findings.some((item) => item.level === "error" && item.message.includes(text));

test("all thirty units contain full learning contracts and original real-candle example surfaces", () => {
  assert.equal(lessons.length, 30);
  lessons.forEach((lesson, i) => {
    assert.equal(lesson.day, i + 1);
    assert.ok(lesson.title.length >= 8);
    for (const field of ["goal", "exercise", "quiz", "answer", "gate", "prompt", "deliverable", "exampleFocus"]) assert.ok(lesson[field].length >= 20, `Day ${lesson.day}: missing ${field}`);
    assert.ok(lesson.learn.length >= 3);
    assert.equal(lesson.draw.length, 3);
    const html = readFileSync(resolve(root, `days/day-${String(lesson.day).padStart(2, "0")}.html`), "utf8");
    for (const id of ["example-chart", "example-count-chart", "example-count-feedback", "price-chart", "count-feedback", "check-mode", "check-count", "export-review", "export-chart", "wick-anchor"]) assert.ok(html.includes(`id="${id}"`), `${lesson.day} missing ${id}`);
    assert.ok(!html.includes("EUR/USD"));
  });
});

test("every generated local link resolves and HTML ids are unique", () => {
  for (const name of ["index.html", "reference.html", ...lessons.map((lesson) => `days/day-${String(lesson.day).padStart(2, "0")}.html`)]) {
    const html = readFileSync(resolve(root, name), "utf8");
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (target.startsWith("#")) assert.ok(ids.includes(target.slice(1)));
      else if (!/^https?:/.test(target)) assert.ok(existsSync(resolve(root, dirname(name), target)), `${name}: ${target}`);
    }
  }
});

test("bundle candles exactly match original MT5 files, with full source identity", () => {
  assert.deepEqual(data, loadWindows(root, lessons));
  for (const [day, window] of Object.entries(windows)) {
    assert.ok(window.bars.length >= 40 && window.bars.length <= 96);
    assert.equal(window.symbol, "XAUUSDm");
    assert.match(window.id, /^[a-f0-9]{64}:/);
    assert.ok(window.timezone.includes("not supplied"));
    assert.equal(window.timeframe, lessons[Number(day) - 1].labTimeframe);
    assert.equal(window.suggestedMode, lessons[Number(day) - 1].checkMode);
    assert.equal(window.measurement, lessons[Number(day) - 1].measurement);
  }
});

test("MT5 parser rejects bad columns, duplicate chronology, empty prices and invalid OHLC", () => {
  const header = "<DATE>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\n";
  const valid = "2024.01.01\t2000\t2010\t1990\t2005";
  assert.equal(parseMt5(header + valid, "test")[0].high, 2010);
  for (const text of [
    "a\tb\n1\t2", header + valid + "\n" + valid,
    header + "2024.01.01\t2000\t1990\t2010\t2005",
    header + "2024.01.01\t\t2010\t1990\t2005",
    header + "2024.01.01\tNaN\t2010\t1990\t2005",
    header + "2024.02.30\t2000\t2010\t1990\t2005"
  ]) assert.throws(() => parseMt5(text, "test"));
});

test("future candles never affect visible OHLC geometry", () => {
  const bars = synthetic([2000, 2010, 3000]);
  const first = core.chartGeometry(bars, 2);
  const second = core.chartGeometry([...bars.slice(0, 2), ...synthetic([10000])], 2);
  assert.equal(first.max, second.max);
  assert.equal(first.min, second.min);
  assert.deepEqual(first.points, second.points);
  assert.equal(first.max < 2100, true);
  assert.throws(() => core.chartGeometry(bars, 0));
  assert.throws(() => core.chartGeometry(bars, 4));
});

test("confirmed examples use only pivots knowable by their own cutoff", () => {
  for (const window of Object.values(windows)) {
    const pivots = core.confirmedPivots(window.bars, window.exampleCutoff);
    pivots.forEach((pivot, i) => {
      assert.ok(pivot.index >= 2);
      assert.equal(pivot.confirmedAt, pivot.index + 2);
      assert.ok(pivot.confirmedAt < window.exampleCutoff);
      if (i) {
        assert.ok(pivot.index > pivots[i - 1].index);
        assert.notEqual(pivot.anchor, pivots[i - 1].anchor);
      }
    });
    const changed = window.bars.map((bar, i) => i < window.exampleCutoff ? bar : { ...bar, high: bar.high * 10 });
    assert.deepEqual(pivots, core.confirmedPivots(changed, window.exampleCutoff));
  }
});

test("worked Elliott candidates disclose hindsight selection and never invent missing endpoints", () => {
  let passingExamples = 0;
  for (const window of Object.values(windows)) {
    for (const mode of core.modes) {
      const example = core.exampleCandidate(window.bars, window.exampleCutoff, mode);
      assert.ok(example.marks.length <= example.needed);
      example.marks.forEach((mark) => assert.ok(mark.index + 2 < window.exampleCutoff));
      if (example.selectedByRules) {
        passingExamples++;
        assert.ok(!core.checkCount(window.bars, window.exampleCutoff, example.marks, mode).findings.some((finding) => finding.level === "error"));
      }
    }
  }
  assert.ok(passingExamples > 0, "Some examples must illustrate passing endpoint checks, not only rejected counts.");
  const short = core.exampleCandidate(synthetic([2000, 2100, 2050]), 3, "impulse");
  assert.equal(short.marks.length, 0);
  assert.equal(short.needed, 6);
});

test("bullish and bearish impulses pass endpoint rules without claiming certification", () => {
  for (const bearish of [false, true]) {
    const prices = bearish ? [2200, 2100, 2160, 1980, 2050, 1940] : [2000, 2100, 2040, 2220, 2150, 2260];
    const { bars, marks } = impulse(prices, bearish);
    const report = core.checkCount(bars, bars.length, marks, "impulse");
    assert.ok(!report.findings.some((item) => item.level === "error"), JSON.stringify(report));
    assert.ok(report.findings.some((item) => item.message.includes("not AI certification")));
  }
});

test("checker rejects origin breaches, shortest thirds, overlap and lack of third-wave progress", () => {
  for (const [prices, expected] of [
    [[2000, 2100, 1990, 2220, 2150, 2260], "Wave 2"],
    [[2000, 2100, 2050, 2120, 2110, 2200], "shortest"],
    [[2000, 2100, 2040, 2220, 2090, 2260], "Wave 4"],
    [[2000, 2100, 2040, 2090, 2070, 2260], "Wave 3 does not"]
  ]) {
    const { bars, marks } = impulse(prices);
    assert.ok(hasError(core.checkCount(bars, bars.length, marks, "impulse"), expected));
    const mirror = impulse(prices.map((price) => 4400 - price), true);
    assert.ok(hasError(core.checkCount(mirror.bars, mirror.bars.length, mirror.marks, "impulse"), expected));
  }
});

test("intervening wick breaches are caught even when selected endpoints look valid", () => {
  const prices = [2000, 2100, 2040, 2220, 2150, 2260];
  const bars = synthetic(prices.flatMap((price, i) => i === prices.length - 1 ? [price] : [price, (price + prices[i + 1]) / 2]));
  const marks = prices.map((price, i) => {
    const anchor = i % 2 ? "high" : "low";
    bars[i * 2][anchor] = price;
    return { index: i * 2, label: String(i), anchor };
  });
  bars[7].low = 2080;
  assert.ok(hasError(core.checkCount(bars, bars.length, marks, "impulse"), "Wave 4"));
});

test("checker does not call truncation a hard error and flags provisional pivots", () => {
  const { bars, marks } = impulse([2000, 2100, 2040, 2220, 2150, 2200]);
  const report = core.checkCount(bars, bars.length, marks, "impulse");
  assert.ok(!report.findings.some((item) => item.level === "error"));
  assert.ok(report.findings.some((item) => item.level === "warning" && item.message.includes("Truncation")));
  assert.ok(report.findings.some((item) => item.message.includes("provisional")));
});

test("drawings with wrong order, duplicate bars, wrong labels or nonalternating anchors get actionable errors", () => {
  const { bars, marks } = impulse([2000, 2100, 2040, 2220, 2150, 2260]);
  assert.ok(hasError(core.checkCount(bars, bars.length, [...marks].reverse(), "impulse"), "chronological") || hasError(core.checkCount(bars, bars.length, [...marks].reverse(), "impulse"), "increasing"));
  assert.ok(hasError(core.checkCount(bars, bars.length, [marks[0], marks[0]], "swings"), "increasing"));
  assert.ok(hasError(core.checkCount(bars, bars.length, marks.map((mark) => ({ ...mark, label: "?" })), "impulse"), "exactly"));
  assert.ok(hasError(core.checkCount(bars, bars.length, marks.map((mark) => ({ ...mark, anchor: "low" })), "impulse"), "alternating"));
  assert.equal(core.checkCount(bars, bars.length, [], "impulse").verdict, "incomplete");
});

test("corrective checks distinguish zigzag origin boundary and flat retracement, and disclose triangle limits", () => {
  const make = (prices) => {
    const bars = synthetic(prices);
    const marks = prices.map((price, i) => {
      const anchor = i % 2 ? "low" : "high"; bars[i][anchor] = price;
      return { index: i, label: ["0", "A", "B", "C"][i], anchor };
    });
    return { bars, marks };
  };
  const zigzag = make([2200, 2100, 2210, 2050]);
  assert.ok(hasError(core.checkCount(zigzag.bars, 4, zigzag.marks, "zigzag"), "B reaches"));
  const flat = make([2200, 2100, 2180, 2050]);
  assert.ok(hasError(core.checkCount(flat.bars, 4, flat.marks, "flat"), "90%"));
  const expanded = make([2200, 2100, 2220, 2050]);
  assert.ok(!core.checkCount(expanded.bars, 4, expanded.marks, "flat").findings.some((item) => item.level === "error"));
  const triangle = impulse([2000, 2100, 2030, 2080, 2040, 2070]);
  triangle.marks.forEach((mark, i) => { mark.label = ["0", "A", "B", "C", "D", "E"][i]; });
  assert.ok(core.checkCount(triangle.bars, 6, triangle.marks, "triangle").findings.some((item) => item.message.includes("cannot certify")));
});

test("gold workbook round-trips marks, checker mode, identity and notes without reading EURUSD schema", () => {
  const workbook = core.emptyWorkbook();
  workbook.days[1] = { ...core.initialDay(windows[1]), completed: true, journal: "Original preserved", mode: "impulse", marks: [{ index: 3, anchor: "low", label: "0" }] };
  assert.deepEqual(core.validateWorkbook(JSON.parse(JSON.stringify(workbook)), windows), workbook);
  for (const bad of [
    { schema: 1, days: {} },
    { ...workbook, dataset: "different" },
    { ...workbook, days: { "31": workbook.days[1] } },
    { ...workbook, days: { "1": { ...workbook.days[1], windowId: "changed" } } },
    { ...workbook, days: { "1": { ...workbook.days[1], marks: [{ index: 90, anchor: "low", label: "0" }] } } },
    { ...workbook, days: { "1": { ...workbook.days[1], mode: "AI" } } },
    { ...workbook, days: { "1": { ...workbook.days[1], marks: [{ index: 2, anchor: "close", label: "0" }] } } }
  ]) assert.throws(() => core.validateWorkbook(bad, windows));
});

test("review exports contain exact visible candles and anchors, not future bars or a fabricated AI answer", () => {
  const state = core.initialDay(windows[2]);
  state.marks = [{ index: 2, anchor: "high", label: "0" }];
  const packet = core.reviewPacket(windows[2], 2, state);
  assert.equal(packet.visibleBars.length, state.cursor);
  assert.equal(packet.cutoff, windows[2].bars[state.cursor - 1].date);
  assert.equal(packet.marks[0].price, windows[2].bars[2].high);
  assert.equal(packet.marks[0].timestamp, windows[2].bars[2].date);
  assert.equal(packet.source, windows[2].source);
  assert.ok(packet.visibleBars.every((bar) => bar.date <= packet.cutoff));
  assert.ok(!packet.visibleBars.some((bar) => bar.date === windows[2].bars.at(-1).date));
});

test("HTML escaping preserves type-safe output", () => {
  assert.equal(escape('<script x="a">&\'</script>'), "&lt;script x=&quot;a&quot;&gt;&amp;&#39;&lt;/script&gt;");
});

test("drawing assistance advances numeric/corrective labels and wick sides without rewriting marks", () => {
  assert.deepEqual(core.nextEndpoint("impulse", "0", "low"), { label: "1", anchor: "high", finished: false });
  assert.deepEqual(core.nextEndpoint("impulse", "1", "high"), { label: "2", anchor: "low", finished: false });
  assert.deepEqual(core.nextEndpoint("zigzag", "0", "high"), { label: "A", anchor: "low", finished: false });
  assert.deepEqual(core.nextEndpoint("flat", "B", "high"), { label: "C", anchor: "low", finished: false });
  assert.deepEqual(core.nextEndpoint("triangle", "D", "low"), { label: "E", anchor: "high", finished: false });
  assert.equal(core.nextEndpoint("impulse", "5", "high").finished, true);
  assert.deepEqual(core.nextEndpoint("swings", "?", "low"), { label: "?", anchor: "low", finished: false });
});

test("thirty topics follow Roadmap.md in order across six five-day stages", () => {
  const roadmap = readFileSync(resolve(root, "Roadmap.md"), "utf8");
  const titles = [...roadmap.matchAll(/^Day (\d+) [—–-] (.+)$/gm)].map((match) => ({ day: Number(match[1]), title: match[2].trim() }));
  assert.equal(titles.length, 30);
  titles.forEach(({ day, title }) => {
    assert.equal(lessons[day - 1].title, title, `Day ${day} must match source roadmap topic`);
  });
  assert.equal(stages.length, 6);
  stages.forEach((stage, i) => {
    assert.deepEqual(stage.days, [i * 5 + 1, i * 5 + 5]);
    const units = lessons.filter((lesson) => lesson.stageId === stage.id);
    assert.equal(units.length, 5);
    assert.ok(stage.goal.length > 20 && stage.milestone.length > 20);
    units.forEach((lesson) => assert.equal(lesson.stage, stage.title));
  });
  assert.equal(lessons[15].checkMode, "zigzag");
  assert.equal(lessons[16].checkMode, "flat");
  assert.equal(lessons[17].checkMode, "triangle");
  assert.equal(lessons[18].exampleKind, "complex");
  assert.equal(lessons[19].exampleKind, "diagonal");
  for (const lesson of lessons.slice(10, 15)) assert.notEqual(lesson.measurement, "none");
});

test("context bars are synchronized to nominal close, never future-completed higher timeframe candles", () => {
  for (const window of Object.values(windows)) {
    for (const cursor of [1, 48, window.bars.length]) {
      const contexts = core.synchronizedContext(window, cursor);
      const cutoff = core.candleEnd(window.bars[cursor - 1].date, window.timeframe);
      assert.deepEqual(Object.keys(contexts), ["Daily", "H4", "H1"]);
      for (const [timeframe, context] of Object.entries(contexts)) {
        assert.equal(context.cutoff, cutoff);
        assert.ok(context.bars.length <= 96);
        assert.ok(context.bars.every((bar) => core.candleEnd(bar.date, timeframe) <= cutoff));
      }
    }
  }
  assert.equal(core.candleEnd("2024-01-31 20:00:00", "H4"), "2024-02-01 00:00:00");
  assert.equal(core.candleEnd("2024-02-28 00:00:00", "Daily"), "2024-02-29 00:00:00");
});

test("retracement, extension and relationship tools measure the actual selected gold wick anchors", () => {
  const { bars, marks } = impulse([2000, 2100, 2040, 2220, 2150, 2260]);
  const result = core.measureAnchors(bars, marks);
  assert.equal(result.levels.find((level) => level.kind === "retracement" && level.ratio === .618).price, 2038.2);
  assert.equal(result.levels.find((level) => level.kind === "extension" && level.ratio === 1.618).price, 2201.8);
  assert.ok(result.notes.some((note) => note.includes("100.000 / 180.000 / 110.000")));
  const mirror = impulse([2200, 2100, 2160, 1980, 2050, 1940], true);
  assert.equal(core.measureAnchors(mirror.bars, mirror.marks).levels.find((level) => level.kind === "retracement" && level.ratio === .618).price, 2161.8);
  assert.equal(core.measureAnchors(bars, []).levels.length, 0);
  assert.throws(() => core.measureAnchors(bars, [marks[1], marks[0]]));
});

test("risk worksheet requires explicit verified inputs and rounds size down", () => {
  const input = { equity: 10000, riskPercent: .5, distance: 10, contract: 100, conversion: 1, costs: 10, step: .01 };
  const sized = core.sizeGold(input);
  assert.equal(sized.budget, 50);
  assert.equal(sized.lots, .04);
  assert.equal(sized.plannedRisk, 40.4);
  assert.ok(sized.plannedRisk <= sized.budget);
  assert.ok(core.sizeGold({ ...input, distance: 20 }).lots <= sized.lots);
  assert.equal(core.sizeGold({ ...input, equity: 1 }).lots, 0);
  for (const bad of [{ ...input, contract: 0 }, { ...input, conversion: NaN }, { ...input, costs: -1 }, { ...input, step: 0 }, { ...input, riskPercent: 101 }]) assert.throws(() => core.sizeGold(bad));
});

test("redesigned persistence rejects previous-course records rather than silently remapping day meanings", () => {
  assert.equal(core.emptyWorkbook().schema, 3);
  assert.equal(core.emptyWorkbook().dataset, "xauusd-roadmap-v3");
  assert.throws(() => core.validateWorkbook({ schema: 2, dataset: "xauusd-mt5-v2", days: {} }, windows));
  const app = readFileSync(resolve(root, "assets/app.js"), "utf8");
  assert.ok(app.includes('const key = "elliott-field-school-roadmap-v3"'));
  assert.ok(app.includes('localStorage.getItem("elliott-field-school-xauusd-v2")'));
  assert.ok(!app.includes('localStorage.setItem("elliott-field-school-xauusd-v2"'));
  assert.ok(readFileSync(resolve(root, "index.html"), "utf8").includes('id="export-previous"'));
});

test("every lesson has substantive bilingual principles, explanatory images and six fully answered exercises", () => {
  validateTeaching();
  assert.equal(teachingUnits.length, 30);
  let principles = 0, questions = 0, figures = 0;
  for (const unit of teachingUnits) {
    assert.ok(unit.principles.length >= 4);
    assert.ok(unit.figures.length >= 2);
    assert.ok(unit.questions.length >= 6);
    for (const principle of unit.principles) {
      for (const language of ["vi", "en"]) assert.ok(principle[language].trim().split(/\s+/).length >= 40, `Day ${unit.day}: insufficient ${language} principle depth`);
      principles++;
    }
    for (const language of ["vi", "en"]) {
      assert.ok(unit.walkthrough[language].trim().split(/\s+/).length >= 65, `Day ${unit.day}: missing worked explanation ${language}`);
      assert.ok(unit.mistakes[language].length >= 100);
    }
    const html = readFileSync(resolve(root, `days/day-${String(unit.day).padStart(2, "0")}.html`), "utf8");
    assert.ok(html.includes('id="deep-principles"'));
    assert.ok(html.includes('id="illustrated-examples"'));
    assert.ok(html.includes('id="question-bank"'));
    assert.equal([...html.matchAll(/data-question="/g)].length, unit.questions.length);
    assert.ok(html.includes('lang="vi"') && html.includes('lang="en"'));
    for (const [i, figure] of unit.figures.entries()) {
      const target = resolve(root, "assets/figures", figureName(unit.day, i));
      assert.ok(existsSync(target));
      const svg = readFileSync(target, "utf8");
      assert.equal(svg, diagramSvg(unit.day, figure, i));
      assert.ok(svg.includes("synthetic teaching diagram"));
      assert.equal([...svg.matchAll(/<circle /g)].length, figure.points.length);
      assert.ok(!svg.includes("NaN") && !svg.includes("Infinity"));
      figures++;
    }
    questions += unit.questions.length;
  }
  assert.ok(principles >= 120 && questions >= 180 && figures >= 60);
});

test("written question responses round-trip without breaking earlier roadmap drawing records", () => {
  const original = core.emptyWorkbook();
  original.days[1] = core.initialDay(windows[1]);
  assert.deepEqual(core.validateWorkbook(original, windows), original);
  const updated = structuredClone(original);
  updated.days[1].answers = { "1": "Sóng 2 vượt điểm gốc nên loại bỏ giả thuyết / Reject the origin breach.", "6": "Keep a provisional count." };
  const restored = core.validateWorkbook(JSON.parse(JSON.stringify(updated)), windows);
  assert.deepEqual(restored, updated);
  assert.deepEqual(core.reviewPacket(windows[1], 1, restored.days[1]).answers, updated.days[1].answers);
  for (const answers of [[], null, { "0": "bad" }, { "1": 15 }, { "1": "x".repeat(12001) }, JSON.parse('{"__proto__":"bad"}')]) {
    const invalid = structuredClone(original);
    invalid.days[1].answers = answers;
    assert.throws(() => core.validateWorkbook(invalid, windows));
  }
});
