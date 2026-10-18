(function (root) {
  "use strict";
  const labels = ["0", "1", "2", "3", "4", "5", "A", "B", "C", "D", "E", "W", "X", "Y", "X2", "Z", "(1)", "(2)", "(3)", "(4)", "(5)", "(A)", "(B)", "(C)", "?"];
  const modes = ["swings", "impulse", "zigzag", "flat", "triangle"];
  function nextEndpoint(mode, label, anchor) {
    const sequence = mode === "zigzag" || mode === "flat" ? ["0", "A", "B", "C"] : mode === "triangle" ? ["0", "A", "B", "C", "D", "E"] : ["0", "1", "2", "3", "4", "5"];
    const i = sequence.indexOf(label);
    if (i < 0 || i === sequence.length - 1) return { label, anchor, finished: i === sequence.length - 1 };
    return { label: sequence[i + 1], anchor: anchor === "low" ? "high" : "low", finished: false };
  }
  const datasets = ["xauusd-roadmap-v3", "xauusd-pdf-v1"];
  const emptyWorkbook = (dataset = datasets[0]) => {
    if (!datasets.includes(dataset)) throw new Error("Unknown curriculum dataset.");
    return { schema: 3, dataset, days: {} };
  };
  const initialDay = (window) => ({ completed: false, journal: "", cursor: Math.min(48, window.bars.length), marks: [], mode: window.suggestedMode || "swings", windowId: window.id });
  function chartGeometry(bars, cursor) {
    if (!bars.length || !Number.isInteger(cursor) || cursor < 1 || cursor > bars.length) throw new Error("Invalid replay cursor.");
    const visible = bars.slice(0, cursor);
    const low = Math.min(...visible.map((bar) => bar.low));
    const high = Math.max(...visible.map((bar) => bar.high));
    const pad = Math.max((high - low) * 0.1, 0.01);
    const min = low - pad, max = high + pad;
    const y = (price) => 28 + (max - price) / (max - min) * 290;
    return { min, max, y, points: visible.map((bar, index) => ({ ...bar, index, x: 78 + index / Math.max(1, bars.length - 1) * 844 })) };
  }
  function validateWorkbook(input, windows, dataset = datasets[0]) {
    const output = emptyWorkbook(dataset);
    if (!input || input.schema !== 3 || input.dataset !== dataset || !input.days || typeof input.days !== "object" || Array.isArray(input.days)) throw new Error("Expected a matching curriculum schema-3 gold workbook. Previous course records remain separate because lesson meanings have changed.");
    for (const [key, state] of Object.entries(input.days)) {
      if (!/^(?:[1-9]|[12][0-9]|30)$/.test(key) || !windows[key]) throw new Error(`Unknown day ${key}`);
      const window = windows[key];
      if (!state || state.windowId !== window.id) throw new Error(`Day ${key}: candle source/window has changed. Do not apply old marks to different candles.`);
      if (typeof state.completed !== "boolean" || typeof state.journal !== "string" || state.journal.length > 100000 || !modes.includes(state.mode)) throw new Error(`Day ${key}: invalid journal, completion, or checker mode`);
      if (!Number.isInteger(state.cursor) || state.cursor < 1 || state.cursor > window.bars.length || !Array.isArray(state.marks) || state.marks.length > 100) throw new Error(`Day ${key}: invalid cursor/marks`);
      const marks = state.marks.map((mark) => {
        if (!mark || !Number.isInteger(mark.index) || mark.index < 0 || mark.index >= state.cursor || !labels.includes(mark.label) || !["high", "low"].includes(mark.anchor)) throw new Error(`Day ${key}: invalid endpoint`);
        return { index: mark.index, label: mark.label, anchor: mark.anchor };
      });
      const answers = {};
      if (state.answers !== undefined) {
        if (!state.answers || typeof state.answers !== "object" || Array.isArray(state.answers)) throw new Error(`Day ${key}: invalid question responses.`);
        for (const [question, response] of Object.entries(state.answers)) {
          if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(question) || typeof response !== "string" || response.length > 12000) throw new Error(`Day ${key}: invalid response ${question}.`);
          answers[question] = response;
        }
      }
      output.days[key] = { completed: state.completed, journal: state.journal, cursor: state.cursor, marks, mode: state.mode, windowId: window.id, ...(state.answers !== undefined ? { answers } : {}) };
    }
    return output;
  }
  function confirmedPivots(bars, cursor) {
    const pivots = [];
    for (let i = 2; i < cursor - 2; i++) {
      const others = [i - 2, i - 1, i + 1, i + 2].map((index) => bars[index]);
      const high = others.every((bar) => bars[i].high > bar.high);
      const low = others.every((bar) => bars[i].low < bar.low);
      // Outside bars do not establish intrabar high/low order.
      if (high === low) continue;
      const pivot = { index: i, anchor: high ? "high" : "low", label: "?", confirmedAt: i + 2 };
      const last = pivots.at(-1);
      if (last?.anchor === pivot.anchor) {
        const field = pivot.anchor;
        if (high ? bars[i][field] > bars[last.index][field] : bars[i][field] < bars[last.index][field]) pivots[pivots.length - 1] = pivot;
      } else pivots.push(pivot);
    }
    return pivots;
  }
  function checkCount(bars, cursor, marks, mode) {
    const findings = [];
    const add = (level, message) => findings.push({ level, message });
    const expected = { impulse: ["0", "1", "2", "3", "4", "5"], zigzag: ["0", "A", "B", "C"], flat: ["0", "A", "B", "C"], triangle: ["0", "A", "B", "C", "D", "E"] };
    if (!modes.includes(mode)) throw new Error("Unknown checker mode");
    if (marks.length < 2) return { verdict: "incomplete", findings: [{ level: "info", message: "Draw at least two endpoints. Choose the relevant checker mode; use 0 at the origin for labeled patterns." }] };
    if (marks.some((mark) => !Number.isInteger(mark.index) || mark.index < 0 || mark.index >= cursor || !["high", "low"].includes(mark.anchor))) {
      return { verdict: "invalid", findings: [{ level: "error", message: "A mark references a hidden candle or invalid anchor." }] };
    }
    if (marks.some((mark, i) => i && mark.index <= marks[i - 1].index)) add("error", "Endpoints must be in strictly increasing candle order. Undo/reposition out-of-order or same-bar points; intrabar order is unknown.");
    if (mode !== "swings" && (marks.length !== expected[mode].length || marks.some((mark, i) => mark.label !== expected[mode][i]))) {
      add("error", `For ${mode}, draw exactly ${expected[mode].join(" -> ")} at one degree. Parenthesized or mixed labels are not assessed; check them separately.`);
    }
    const points = marks.map((mark) => bars[mark.index][mark.anchor]);
    for (let i = 1; i < marks.length; i++) {
      if (marks[i].anchor === marks[i - 1].anchor) add("error", `Endpoints ${i - 1}/${i} both use ${marks[i].anchor}. Select alternating high/low wick anchors.`);
      const rising = marks[i - 1].anchor === "low";
      if (rising ? points[i] <= points[i - 1] : points[i] >= points[i - 1]) add("error", `Leg ${i} does not move in its selected low-to-high/high-to-low direction.`);
      if (marks[i].index > marks[i - 1].index) {
        const segment = bars.slice(marks[i - 1].index, marks[i].index + 1);
        const upper = Math.max(points[i - 1], points[i]), lower = Math.min(points[i - 1], points[i]);
        if (segment.some((bar) => bar.high > upper + 1e-8 || bar.low < lower - 1e-8)) add("warning", `Leg ${i}: an intervening wick exceeds the selected endpoint range. Recheck extrema/degree; endpoint-only tests may be misleading.`);
      }
    }
    marks.forEach((mark, i) => {
      if (mark.index < 2 || mark.index + 2 >= cursor) {
        add("warning", `Endpoint ${mark.label}: two-bars-each-side pivot confirmation is unavailable at this replay cutoff. Keep it provisional.`);
      } else {
        const others = [-2, -1, 1, 2].map((offset) => bars[mark.index + offset][mark.anchor]);
        const price = points[i];
        if (!others.every((other) => mark.anchor === "high" ? price > other : price < other)) add("warning", `Endpoint ${mark.label}: not a strict two-bar ${mark.anchor} pivot. Check whether you selected a wick extreme rather than a nearby candle.`);
      }
    });
    const patternReady = mode !== "swings" && marks.length === expected[mode].length && marks.every((mark, i) => mark.label === expected[mode][i]);
    if (patternReady) {
      const direction = points[1] > points[0] ? 1 : -1;
      const p = points.map((price) => direction * price);
      const length = (a, b) => Math.abs(points[b] - points[a]);
      if (mode === "impulse") {
        add("info", `Measured directional lengths: wave 1 = ${length(0, 1).toFixed(3)}, wave 3 = ${length(2, 3).toFixed(3)}, wave 5 = ${length(4, 5).toFixed(3)} USD/oz. Wave-2 origin boundary = ${points[0].toFixed(3)}; wave-4 no-overlap boundary = ${points[1].toFixed(3)}. Use the same degree and verify subdivisions.`);
        const adverseExtreme = (start, end) => {
          const segment = bars.slice(marks[start].index + 1, marks[end].index + 1);
          if (!segment.length) return Infinity;
          return direction > 0 ? Math.min(...segment.map((bar) => bar.low)) : -Math.max(...segment.map((bar) => bar.high));
        };
        if (p[2] <= p[0] || adverseExtreme(1, 2) <= p[0]) add("error", "Wave 2 reaches/crosses the wave-1 origin (including intervening wicks). Reject this standard impulse under the course's conservative boundary policy; do not rescue it by moving 0.");
        if (p[3] <= p[1]) add("error", "Wave 3 does not progress beyond wave 1. Revisit the degree or whether this is a correction.");
        if (length(2, 3) + 1e-8 < Math.min(length(0, 1), length(4, 5))) add("error", "Wave 3 is shortest of 1, 3, and 5. Reject the standard-impulse labeling; inspect the internal swings before trying another count.");
        if (p[4] <= p[1] || adverseExtreme(3, 4) <= p[1]) add("error", "Wave 4 touches/overlaps wave-1 territory (including intervening wicks). Reject this standard impulse. A diagonal needs independent evidence and is not automatically the correction.");
        if (p[5] <= p[3]) add("warning", "Wave 5 does not exceed wave 3. Truncation is not verified: inspect complete fifth-wave subdivisions; do not assume an exception.");
      }
      if (mode === "zigzag") {
        if (p[2] <= p[0]) add("error", "B reaches/exceeds A's origin under the course's conservative boundary policy. This is not a standard zigzag candidate.");
        if (p[3] <= p[1]) add("warning", "C fails to pass A's endpoint. A usual completed zigzag is not established.");
        add("info", "Price boundaries alone cannot confirm 5-3-5 internals. Inspect A and C on a lower timeframe.");
      }
      if (mode === "flat") {
        const ratio = length(1, 2) / length(0, 1);
        if (ratio < .9 - 1e-8) add("error", `B retraces ${(ratio * 100).toFixed(1)}% of A, below the course's 90% flat qualification. Revisit the pattern.`);
        add("info", "Verify 3-3-5 internals. A B overshoot can be consistent with an expanded flat; it is not by itself an error.");
      }
      if (mode === "triangle") {
        add("info", "Five alternating legs do not confirm a triangle. Verify corrective internals, boundary geometry, and a permitted parent position (often 4/B); the checker cannot certify them.");
      }
    }
    const errors = findings.some((finding) => finding.level === "error");
    const warnings = findings.some((finding) => finding.level === "warning");
    add("info", "This is a limited rule screen, not AI certification, a unique correct count, or a trading signal. Export your review packet and share it in chat for contextual correction.");
    return { verdict: errors ? "revise" : warnings ? "needs-review" : "no-violation-detected", findings };
  }
  function reviewPacket(window, day, state) {
    return {
      format: "elliott-review-v1", day, ...(window.curriculum ? { curriculum: window.curriculum, unitTitle: window.unitTitle } : {}), symbol: window.symbol, timeframe: window.timeframe,
      source: window.source, windowId: window.id, timezone: window.timezone,
      cutoff: window.bars[state.cursor - 1].date, mode: state.mode,
      marks: state.marks.map((mark) => ({ ...mark, timestamp: window.bars[mark.index].date, price: window.bars[mark.index][mark.anchor] })),
      visibleBars: window.bars.slice(0, state.cursor),
      synchronizedContext: synchronizedContext(window, state.cursor),
      journal: state.journal, answers: state.answers || {},
      ...(window.sourceLesson ? { sourceChartReview: {
        figure: window.sourceLesson.figure,
        ...(window.sourceLesson.comparisonFigure ? { comparisonFigure: window.sourceLesson.comparisonFigure } : {}),
        teaching: { observe: window.sourceLesson.observe, principle: window.sourceLesson.principle, limitation: window.sourceLesson.limitation },
        coordinateSystem: "0–1000 normalized; top-left origin; independent of MT5 chart",
        questions: window.sourceLesson.questions.map((question) => ({
          ...question, selectedAnswer: state.answers?.[question.slot] || ""
        })),
        note: "Checks only the requested annotated image region, not a full Elliott count."
      } } : {}),
      ...(window.rsiHistory ? { rsi: {
        period: 14, method: "Wilder", appliedTo: "close",
        warmupCloses: window.rsiHistory,
        note: "Reproduce from warm-up closes followed by visibleBars only; no later candle is included."
      } } : {}),
      ...(window.questions ? { quizReview: window.questions.map((question, index) => ({
        question: question.prompt,
        selectedAnswer: state.answers?.[index + 1] || "",
        correctAnswer: question.options[question.correct],
        explanation: question.explanation
      })) } : {}),
      automatedReview: checkCount(window.bars, state.cursor, state.marks, state.mode)
    };
  }
  const hours = { Daily: 24, H4: 4, H1: 1 };
  function candleEnd(timestamp, timeframe) {
    if (!hours[timeframe]) throw new Error("Unsupported timeframe");
    return new Date(Date.parse(timestamp.replace(" ", "T") + "Z") + hours[timeframe] * 3600000).toISOString().slice(0, 19).replace("T", " ");
  }
  function synchronizedContext(window, cursor) {
    if (!Number.isInteger(cursor) || cursor < 1 || cursor > window.bars.length) throw new Error("Invalid context cutoff");
    const cutoff = candleEnd(window.bars[cursor - 1].date, window.timeframe);
    return Object.fromEntries(Object.entries(window.context || {}).map(([tf, context]) => [
      tf, { source: context.source, cutoff, bars: context.bars.filter((bar) => candleEnd(bar.date, tf) <= cutoff).slice(-96) }
    ]));
  }
  function measureAnchors(bars, marks) {
    if (marks.length < 2) return { levels: [], notes: ["Select at least two chronological wick endpoints to measure a leg."] };
    if (marks.some((mark, i) => !bars[mark.index] || !["high", "low"].includes(mark.anchor) || (i && mark.index <= marks[i - 1].index))) throw new Error("Measurements need chronological, distinct candle wick anchors.");
    const prices = marks.map((mark) => bars[mark.index][mark.anchor]);
    const distance = Math.abs(prices[1] - prices[0]);
    if (distance === 0) throw new Error("Cannot measure a zero-length leg.");
    const direction = Math.sign(prices[1] - prices[0]);
    const levels = [.382, .5, .618, .786].map((ratio) => ({ kind: "retracement", ratio, price: prices[1] - ratio * (prices[1] - prices[0]) }));
    const notes = [`First leg length: ${distance.toFixed(3)} USD/oz. Anchors are your observations, not certified waves.`];
    if (prices.length >= 3) {
      notes.push(`Second leg retraces ${(Math.abs(prices[2] - prices[1]) / distance * 100).toFixed(2)}% of the first leg; verify its direction separately.`);
      levels.push(...[1, 1.618, 2.618].map((ratio) => ({ kind: "extension", ratio, price: prices[2] + direction * ratio * distance })));
    }
    if (prices.length >= 6) notes.push(`Proposed lengths 1/3/5: ${distance.toFixed(3)} / ${Math.abs(prices[3] - prices[2]).toFixed(3)} / ${Math.abs(prices[5] - prices[4]).toFixed(3)} USD/oz. Fibonacci ratios never rescue a hard-rule violation.`);
    return { levels, notes };
  }
  function sizeGold({ equity, riskPercent, distance, contract, conversion, costs, step }) {
    if (![equity, riskPercent, distance, contract, conversion, step].every((value) => Number.isFinite(value) && value > 0) || riskPercent > 100 || !Number.isFinite(costs) || costs < 0) throw new Error("Enter positive verified inputs, risk at most 100%, and nonnegative costs. No broker defaults are supplied.");
    const budget = equity * riskPercent / 100;
    const riskPerLot = distance * contract * conversion + costs;
    const lots = Math.floor((budget / riskPerLot + 1e-12) / step) * step;
    return { budget, riskPerLot, lots, plannedRisk: lots * riskPerLot };
  }
  function exampleCandidate(bars, cursor, mode) {
    const sequences = { swings: ["P1", "P2", "P3", "P4", "P5", "P6"], impulse: ["0", "1", "2", "3", "4", "5"], zigzag: ["0", "A", "B", "C"], flat: ["0", "A", "B", "C"], triangle: ["0", "A", "B", "C", "D", "E"] };
    const sequence = sequences[mode];
    if (!sequence) throw new Error("Unsupported worked-example mode");
    const pivots = confirmedPivots(bars, cursor);
    const candidates = [];
    for (let start = 0; start <= Math.max(0, pivots.length - sequence.length); start++) {
      const marks = pivots.slice(start, start + sequence.length).map((pivot, i) => ({ index: pivot.index, anchor: pivot.anchor, label: sequence[i] }));
      candidates.push(marks);
    }
    const passing = mode === "swings" ? undefined : candidates.find((marks) => marks.length === sequence.length && !checkCount(bars, cursor, marks, mode).findings.some((finding) => finding.level === "error"));
    return { marks: passing || candidates[0], needed: sequence.length, selectedByRules: Boolean(passing) };
  }
  const api = { labels, modes, nextEndpoint, emptyWorkbook, initialDay, chartGeometry, validateWorkbook, confirmedPivots, checkCount, reviewPacket, exampleCandidate, candleEnd, synchronizedContext, measureAnchors, sizeGold };
  root.ElliottCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
