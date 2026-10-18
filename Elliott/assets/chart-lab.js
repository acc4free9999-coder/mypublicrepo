(function () {
  "use strict";
  const app = globalThis.ElliottApp;
  if (!app.day) return;
  const core = globalThis.ElliottCore;
  const window = globalThis.ElliottData.windowsByDay[app.day];
  const bars = window.bars;
  const svg = document.getElementById("price-chart");
  const label = document.getElementById("wave-label"), anchor = document.getElementById("wick-anchor");
  const candleSelect = document.getElementById("observation-select"), mode = document.getElementById("check-mode");
  const feedback = document.getElementById("count-feedback");
  const ns = "http://www.w3.org/2000/svg";
  let geometry;
  function node(type, attributes, text) {
    const result = document.createElementNS(ns, type);
    for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, String(value));
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function candleChart(target, source, cursor, marks, example = false, timeframe = window.timeframe) {
    const geo = core.chartGeometry(source, cursor);
    target.replaceChildren();
    target.append(node("title", {}, example ? "Worked observed pivots on real XAUUSDm candles" : "Your XAUUSDm candle drawing"));
    const group = node("g", {});
    for (let i = 0; i <= 4; i++) {
      const y = 28 + i / 4 * 290;
      group.append(node("line", { x1: 78, x2: 922, y1: y, y2: y, stroke: "#d8dfd5" }));
      group.append(node("text", { x: 70, y: y + 4, "text-anchor": "end", fill: "#516466" }, (geo.max - i / 4 * (geo.max - geo.min)).toFixed(3)));
    }
    const width = Math.min(9, 844 / source.length * .65);
    for (const bar of geo.points) {
      const color = bar.close >= bar.open ? "#176455" : "#b54f24";
      group.append(node("line", { x1: bar.x, x2: bar.x, y1: geo.y(bar.high), y2: geo.y(bar.low), stroke: color, "stroke-width": 1 }));
      const body = node("rect", { x: bar.x - width / 2, y: geo.y(Math.max(bar.open, bar.close)), width, height: Math.max(1, Math.abs(geo.y(bar.open) - geo.y(bar.close))), fill: color });
      body.append(node("title", {}, `${bar.date} | O ${bar.open} H ${bar.high} L ${bar.low} C ${bar.close}`));
      group.append(body);
    }
    const last = geo.points.at(-1);
    if (cursor < source.length) {
      group.append(node("rect", { x: last.x + width / 2 + 1, y: 28, width: Math.max(0, 922 - last.x - width / 2 - 1), height: 290, fill: "#e8ecdf", opacity: .4 }));
      if (922 - last.x > 130) group.append(node("text", { x: last.x + 20, y: 170, fill: "#516466" }, "Future hidden"));
    }
    if (marks.length > 1) group.append(node("polyline", {
      points: marks.map((mark) => `${geo.points[mark.index].x},${geo.y(source[mark.index][mark.anchor])}`).join(" "),
      fill: "none", stroke: "#6334a0", "stroke-width": 2
    }));
    marks.forEach((mark, i) => {
      const point = geo.points[mark.index], y = geo.y(source[mark.index][mark.anchor]);
      group.append(node("circle", { cx: point.x, cy: y, r: 3.5, fill: "#6334a0" }));
      const duplicates = marks.slice(0, i).filter((other) => other.index === mark.index).length;
      group.append(node("text", { x: point.x, y: Math.max(15, Math.min(335, y + (mark.anchor === "high" ? -12 : 19) + duplicates * 13)), "text-anchor": "middle", fill: "#542b88", "font-weight": 700 }, mark.label));
    });
    group.append(node("text", { x: 78, y: 351, fill: "#516466" }, source[0].date));
    group.append(node("text", { x: 922, y: 351, fill: "#516466", "text-anchor": "end" }, last.date));
    group.append(node("text", { x: 78, y: 375, fill: "#516466" }, `XAUUSDm ${timeframe} | USD/oz | MT5 server time (offset unknown)`));
    target.append(group);
    return geo;
  }
  function stale() {
    feedback.replaceChildren();
    feedback.textContent = "Drawing or cutoff changed. Run Check my count again; earlier feedback no longer applies.";
    const measurements = document.getElementById("measurement-results");
    if (measurements) measurements.textContent = "Anchors/cutoff changed. Measure again.";
  }
  function render() {
    const state = app.state();
    mode.value = state.mode;
    geometry = candleChart(svg, bars, state.cursor, state.marks);
    const selected = candleSelect.value;
    candleSelect.replaceChildren();
    const table = document.getElementById("visible-data");
    table.replaceChildren();
    geometry.points.forEach((bar) => {
      const option = document.createElement("option");
      option.value = bar.index; option.textContent = `${bar.date} | H ${bar.high.toFixed(3)} L ${bar.low.toFixed(3)}`;
      candleSelect.append(option);
      const row = document.createElement("tr");
      const marks = state.marks.filter((mark) => mark.index === bar.index).map((mark) => `${mark.label} @ ${mark.anchor}`).join(", ");
      [bar.date, ...["open", "high", "low", "close"].map((field) => bar[field].toFixed(3)), marks || "-"].forEach((text) => {
        const cell = document.createElement("td"); cell.textContent = text; row.append(cell);
      });
      table.append(row);
    });
    if (selected && Number(selected) < state.cursor) candleSelect.value = selected;
    document.getElementById("replay-status").textContent = `${state.cursor} of ${bars.length} candles visible | ${bars[state.cursor - 1].date} | ${state.marks.length} endpoints`;
    document.getElementById("step-one").disabled = state.cursor === bars.length;
    document.getElementById("step-five").disabled = state.cursor === bars.length;
    document.getElementById("undo-mark").disabled = !state.marks.length;
    const linked = document.getElementById("linked-context");
    const openContexts = new Set([...linked.querySelectorAll("details[open]")].map((panel) => panel.dataset.timeframe));
    linked.replaceChildren();
    for (const [timeframe, context] of Object.entries(core.synchronizedContext(window, state.cursor))) {
      const panel = document.createElement("details");
      panel.dataset.timeframe = timeframe;
      panel.open = openContexts.has(timeframe);
      const summary = document.createElement("summary");
      summary.textContent = `${timeframe}: ${context.bars.length} completed bars | cutoff ${context.cutoff}`;
      const chart = node("svg", { viewBox: "0 0 960 385", role: "img", "aria-label": `Linked ${timeframe} context, completed candles only` });
      const shell = document.createElement("div"); shell.className = "chart-shell";
      if (context.bars.length) candleChart(chart, context.bars, context.bars.length, [], true, timeframe);
      const caption = document.createElement("p");
      caption.className = "caption";
      caption.textContent = context.bars.length ? `${context.source}. Earliest shown ${context.bars[0].date}. Candle timestamps are opens; displayed cutoff is the nominal close of the last practice bar. No partial higher-timeframe candle is included.` : "No completed bars in the loaded source segment at this cutoff; use wider terminal history.";
      shell.append(chart); panel.append(summary, shell, caption); linked.append(panel);
    }
    document.dispatchEvent(new Event("chart-rendered"));
  }
  function changed() { app.persist(); stale(); render(); }
  function addMark(index) {
    const state = app.state();
    if (!Number.isInteger(index) || index < 0 || index >= state.cursor) { app.status.textContent = "Hidden/invalid candle: reveal it before drawing."; return; }
    if (state.marks.length >= 100) { app.status.textContent = "100-endpoint limit: undo or reset first."; return; }
    const added = { index, label: label.value, anchor: anchor.value };
    state.marks.push(added);
    changed();
    if (document.getElementById("auto-next").checked) {
      const next = core.nextEndpoint(state.mode, added.label, added.anchor);
      label.value = next.label; anchor.value = next.anchor;
      if (next.finished) app.status.textContent = "Pattern sequence complete. Run Check my count; do not add extra endpoints to the same candidate.";
    }
  }
  core.labels.forEach((text) => {
    const option = document.createElement("option"); option.value = text; option.textContent = text; label.append(option);
  });
  function continueSequence() {
    const last = app.state().marks.at(-1);
    const next = last ? core.nextEndpoint(app.state().mode, last.label, last.anchor) : { label: "0", anchor: "low" };
    label.value = next.label; anchor.value = next.anchor;
  }
  continueSequence();
  document.getElementById("add-mark").addEventListener("click", () => addMark(Number(candleSelect.value)));
  document.getElementById("undo-mark").addEventListener("click", () => {
    const removed = app.state().marks.pop();
    if (removed) { label.value = removed.label; anchor.value = removed.anchor; }
    changed();
  });
  for (const [id, count] of [["step-one", 1], ["step-five", 5]]) {
    document.getElementById(id).addEventListener("click", () => { app.state().cursor = Math.min(bars.length, app.state().cursor + count); changed(); });
  }
  mode.addEventListener("change", () => {
    app.state().mode = mode.value;
    if (!app.state().marks.length) label.value = "0";
    changed();
  });
  document.getElementById("reset-chart").addEventListener("click", () => {
    if (!confirm("Remove this day's drawing and restart replay? Your journal and completion are preserved.")) return;
    app.state().marks = []; app.state().cursor = core.initialDay(window).cursor; continueSequence(); changed();
  });
  svg.addEventListener("click", (event) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) { app.error("Chart coordinates unavailable: use the accessible candle selector."); return; }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (point.x < 74 || point.x > 926 || point.y < 28 || point.y > 318) return;
    const index = Math.round((point.x - 78) / 844 * Math.max(1, bars.length - 1));
    addMark(index); candleSelect.value = String(index);
  });
  document.getElementById("check-count").addEventListener("click", () => {
    const state = app.state(), report = core.checkCount(bars, state.cursor, state.marks, state.mode);
    feedback.replaceChildren();
    const heading = document.createElement("strong"); heading.textContent = `Review: ${report.verdict.replaceAll("-", " ")}`;
    const list = document.createElement("ul");
    report.findings.forEach((finding) => {
      const item = document.createElement("li"); item.textContent = `${finding.level.toUpperCase()}: ${finding.message}`; list.append(item);
    });
    feedback.append(heading, list);
  });
  function showMeasurements(target, measured) {
    target.replaceChildren();
    measured.notes.forEach((text) => { const p = document.createElement("p"); p.textContent = text; target.append(p); });
    const list = document.createElement("ul");
    measured.levels.forEach((level) => {
      const item = document.createElement("li");
      item.textContent = `${level.kind} ${level.kind === "retracement" ? (level.ratio * 100).toFixed(1) + "%" : level.ratio + "x"}: ${level.price.toFixed(3)} USD/oz`;
      list.append(item);
    });
    target.append(list);
  }
  function drawLevels(target, geo, levels) {
    for (const level of levels) {
      if (level.price < geo.min || level.price > geo.max) continue;
      const y = geo.y(level.price);
      target.append(node("line", { class: "measurement-guide", x1: 78, x2: 922, y1: y, y2: y, stroke: level.kind === "retracement" ? "#6334a0" : "#176455", "stroke-dasharray": "4 4", opacity: .6 }));
      target.append(node("text", { class: "measurement-guide", x: 915, y: y - 4, "text-anchor": "end", fill: "#542b88" }, `${level.ratio} ${level.price.toFixed(3)}`));
    }
  }
  document.getElementById("measure-anchors")?.addEventListener("click", () => {
    const target = document.getElementById("measurement-results");
    try {
      const measured = core.measureAnchors(bars, app.state().marks);
      svg.querySelectorAll(".measurement-guide").forEach((guide) => guide.remove());
      showMeasurements(target, measured);
      drawLevels(svg, geometry, measured.levels);
    } catch (cause) { target.textContent = `Measurement rejected: ${cause.message}`; }
  });
  document.getElementById("risk-calculator")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = document.getElementById("risk-result");
    try {
      const input = Object.fromEntries([...new FormData(event.target)].map(([key, value]) => [key, Number(value)]));
      const result = core.sizeGold(input);
      target.textContent = `Budget ${result.budget.toFixed(2)}; modeled risk/lot ${result.riskPerLot.toFixed(2)}; rounded size ${Number(result.lots.toFixed(8))} lots; planned risk ${result.plannedRisk.toFixed(2)} in account currency. ${result.lots === 0 ? "Below the specified lot step: skip; do not round up." : "Also verify broker minimum volume, margin, execution price basis and potential excess slippage."} Copy the verified inputs and result into your journal; this calculator is not saved automatically.`;
    } catch (cause) { target.textContent = `Sizing rejected: ${cause.message}`; }
  });
  document.getElementById("export-review").addEventListener("click", () => {
    app.saveJournal();
    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    app.download(JSON.stringify(core.reviewPacket(window, app.day, app.state()), null, 2), `xauusd-day-${app.day}-review-${stamp}.json`, "application/json");
    app.status.textContent = "Review download requested. Attach that JSON in chat for detailed correction; nothing was sent automatically.";
  });
  document.getElementById("export-chart").addEventListener("click", () => {
    const copy = svg.cloneNode(true);
    copy.setAttribute("xmlns", ns);
    copy.setAttribute("width", "1440"); copy.setAttribute("height", "578");
    const rsi = document.getElementById("rsi-chart");
    if (rsi) {
      copy.setAttribute("viewBox", "0 0 960 585");
      copy.setAttribute("height", "878");
      const panel = node("g", { transform: "translate(0 385)" });
      for (const child of rsi.children) panel.append(child.cloneNode(true));
      copy.append(panel);
    }
    copy.querySelectorAll("text").forEach((text) => { text.setAttribute("font-family", "sans-serif"); text.setAttribute("font-size", "12"); });
    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    app.download(new XMLSerializer().serializeToString(copy), `xauusd-day-${app.day}-drawing-${stamp}.svg`, "image/svg+xml");
    app.status.textContent = "Drawn chart SVG download requested.";
  });
  const exampleBars = bars.slice(0, window.exampleCutoff);
  const pivots = core.confirmedPivots(exampleBars, exampleBars.length).slice(0, 8);
  const exampleMarks = pivots.map((pivot, i) => ({ ...pivot, label: `P${i + 1}` }));
  const exampleSvg = document.getElementById("example-chart");
  const exampleGeometry = candleChart(exampleSvg, exampleBars, exampleBars.length, exampleMarks, true);
  const explanation = document.getElementById("example-explanation");
  const intro = document.createElement("p");
  intro.textContent = pivots.length < 3 ? "Too few unambiguous confirmed pivots for a pattern demonstration. This is a worked example of why to keep a no-count, not force more labels." : "Follow the exact wick anchors below. Adjacent pivot distances are observations, not confirmed Elliott subdivisions.";
  explanation.append(intro);
  const pivotList = document.createElement("ol");
  pivots.forEach((pivot, i) => {
    const item = document.createElement("li");
    const price = bars[pivot.index][pivot.anchor];
    const previous = pivots[i - 1];
    const distance = previous ? `; distance from P${i}: ${Math.abs(price - bars[previous.index][previous.anchor]).toFixed(3)} USD/oz` : "";
    item.textContent = `P${i + 1}: ${bars[pivot.index].date}, ${pivot.anchor} ${price.toFixed(3)}; confirmed after ${bars[pivot.confirmedAt].date}${distance}.`;
    pivotList.append(item);
  });
  explanation.append(pivotList);
  if (window.measurement !== "none") {
    const measuredPivots = window.measurement === "confluence" && pivots.length >= 4 ? pivots.slice(2, 8) : pivots.slice(0, 6);
    const measured = core.measureAnchors(exampleBars, measuredPivots);
    const result = document.createElement("div"); result.className = "worked-measurements";
    const selectedAnchors = document.createElement("p");
    selectedAnchors.textContent = `Worked measurement anchors: ${measuredPivots.map((pivot) => `${bars[pivot.index].date} ${pivot.anchor} ${bars[pivot.index][pivot.anchor].toFixed(3)}`).join(" -> ") || "too few confirmed pivots"}.`;
    result.append(selectedAnchors);
    const values = document.createElement("div");
    showMeasurements(values, measured);
    result.append(values);
    const relevantLevels = window.measurement === "retracement" ? measured.levels.filter((level) => level.kind === "retracement") : window.measurement === "extension" ? measured.levels.filter((level) => level.kind === "extension") : measured.levels;
    drawLevels(exampleSvg, exampleGeometry, relevantLevels);
    const disclaimer = document.createElement("p");
    disclaimer.textContent = "These exact observed-anchor calculations illustrate this unit's measurement method. Off-scale levels remain in the list, not forced into future-aware chart scaling. Pivots are not certified wave endpoints. Confluence must be compared with independent visible support/resistance; this tool does not invent it.";
    result.append(disclaimer); explanation.append(result);
    if (window.measurement === "confluence" && measuredPivots.length >= 2 && measuredPivots[0] !== pivots[0]) {
      const prior = pivots.slice(0, 2).map((pivot) => ({ kind: "support/resistance", ratio: "prior swing", price: bars[pivot.index][pivot.anchor] }));
      drawLevels(exampleSvg, exampleGeometry, prior);
      const comparison = document.createElement("p");
      comparison.textContent = `Earlier observed swing references: ${prior.map((level) => level.price.toFixed(3)).join(", ")} USD/oz. Compare them with the listed retracement/extension prices. Define a distance tolerance before calling a cluster; a disagreement is a useful finding, not a reason to move anchors. Prior swings and ratios describe related price data, not independent probabilities.`;
      result.append(comparison);
    }
  }
  const exampleMode = window.suggestedMode;
  const example = core.exampleCandidate(exampleBars, exampleBars.length, exampleMode);
  const special = window.exampleKind === "complex" ? ["0", "W", "X", "Y"] : window.exampleKind === "diagonal" ? ["0", "1", "2", "3", "4", "5"] : null;
  if (special) {
    example.marks = pivots.slice(0, special.length).map((pivot, i) => ({ index: pivot.index, anchor: pivot.anchor, label: special[i] }));
    example.needed = special.length;
    example.selectedByRules = false;
  }
  const candidate = example.marks;
  const candidateSvg = document.getElementById("example-count-chart");
  const candidateGeometry = candleChart(candidateSvg, exampleBars, exampleBars.length, candidate, true);
  const audit = document.getElementById("example-count-feedback");
  const candidateIntro = document.createElement("p");
  candidateIntro.textContent = candidate.length < example.needed
    ? `Only ${candidate.length} confirmed pivots are available; ${example.needed} endpoints are needed for this demonstration. Correction: leave this candidate incomplete; do not invent the missing waves.`
    : `Worked hypothesis: ${exampleMode}. ${example.selectedByRules ? "For teaching, we retrospectively selected the first consecutive-pivot sequence that passes the limited endpoint rule screen. This is selection with hindsight, not evidence of predictive skill or verified internals." : "The first observed pivots are labeled as a tentative candidate to show the audit, not to manufacture a perfect pattern."} If the audit fails, reject this labeling, inspect degree/internals, and retain no-count until supported.`;
  audit.append(candidateIntro);
  const anchors = document.createElement("p");
  anchors.textContent = candidate.map((mark) => `${mark.label}: ${bars[mark.index].date}, ${mark.anchor} ${bars[mark.index][mark.anchor].toFixed(3)}`).join(" | ");
  audit.append(anchors);
  if (app.day === 1 && candidate.length >= 6) {
    const later = core.confirmedPivots(exampleBars, exampleBars.length).filter((pivot) => pivot.index > candidate.at(-1).index).slice(0, 3);
    const cycle = document.createElement("p");
    cycle.textContent = later.length === 3
      ? `Following observed turns can be tentatively called A/B/C at ${later.map((pivot) => `${bars[pivot.index].date} (${bars[pivot.index][pivot.anchor].toFixed(3)})`).join(", ")}. This illustrates the proposed five-plus-three cycle, not verified corrective internals.`
      : "The cutoff does not supply three later confirmed turns after this candidate. The ABC part of the proposed cycle remains incomplete; do not reveal unseen future candles or manufacture a completed correction.";
    audit.append(cycle);
    if (later.length === 3) {
      const cycleMarks = [...candidate, ...later.map((pivot, i) => ({ index: pivot.index, anchor: pivot.anchor, label: ["A", "B", "C"][i] }))];
      candleChart(candidateSvg, exampleBars, exampleBars.length, cycleMarks, true);
    }
  }
  if ((window.curriculum === "xauusd-pdf-v1" ? [5, 20] : [4, 13, 15]).includes(app.day) && candidate.length >= 6) {
    const prices = candidate.map((mark) => bars[mark.index][mark.anchor]);
    const w1 = Math.abs(prices[1] - prices[0]), w3 = Math.abs(prices[3] - prices[2]), w5 = Math.abs(prices[5] - prices[4]);
    const compare = document.createElement("p");
    compare.textContent = `Worked comparison for this provisional skeleton: wave 2 retraces ${(Math.abs(prices[2] - prices[1]) / w1 * 100).toFixed(2)}% of wave 1 across ${candidate[2].index - candidate[1].index} bars; wave 4 retraces ${(Math.abs(prices[4] - prices[3]) / w3 * 100).toFixed(2)}% of wave 3 across ${candidate[4].index - candidate[3].index} bars. Directional lengths 1/3/5 are ${w1.toFixed(3)}, ${w3.toFixed(3)}, ${w5.toFixed(3)} USD/oz. Compare depth and duration, but do not require alternation or a particular Fibonacci ratio. These measurements do not repair any failed count.`;
    audit.append(compare);
  }
  if (special) {
    const limits = document.createElement("p");
    limits.textContent = window.exampleKind === "complex"
      ? "Recognition-only W-X-Y hypothesis: each W/Y must itself be a complete corrective structure and X a connector. One observed leg is not proof of a whole corrective block. Inspect lower-timeframe internals; if unsupported, retain the simpler unclear/no-count. The swings checker cannot validate W-X-Y or a triple combination."
      : "Recognition-only diagonal hypothesis: overlap is not tested as a standard-impulse error here. First establish a leading 1/A or ending 5/C parent position, appropriate five-wave geometry, and internal subdivisions. The swings checker cannot certify any diagonal. Do not use this label to rescue a failed impulse.";
    audit.append(limits);
  }
  if ([3, 6, 10, 22, 23].includes(app.day) && candidate.length >= 2) {
    const price = bars[candidate[0].index][candidate[0].anchor];
    drawLevels(candidateSvg, candidateGeometry, [{ kind: "retracement", ratio: "origin", price }]);
    const boundary = document.createElement("p");
    boundary.textContent = `The origin guide is ${price.toFixed(3)} USD/oz. For a proposed standard impulse, a wave-2 breach rejects that count. It is not an automatic trade stop or permission to move the origin.`;
    audit.append(boundary);
  }
  if (exampleMode === "triangle" && candidate.length >= 5) {
    for (const [a, b] of [[1, 3], [2, 4]]) {
      candidateSvg.append(node("line", {
        x1: candidateGeometry.points[candidate[a].index].x, x2: candidateGeometry.points[candidate[b].index].x,
        y1: candidateGeometry.y(bars[candidate[a].index][candidate[a].anchor]), y2: candidateGeometry.y(bars[candidate[b].index][candidate[b].anchor]),
        stroke: "#b54f24", "stroke-dasharray": "5 4"
      }));
    }
  }
  if (window.exampleKind === "alternates") {
    const alternative = document.createElement("p");
    alternative.textContent = "Competing interpretation exercise: compare this candidate with a correction at a larger degree using the same visible prices. Do not merely reverse the direction label. State each hypothesis's own structural requirements, numerical invalidation, and next confirming event. Export the primary before resetting/redrawing the alternate; record the two packet names in your journal.";
    audit.append(alternative);
  }
  if (candidate.length === example.needed) {
    const report = core.checkCount(exampleBars, exampleBars.length, candidate, special ? "swings" : exampleMode);
    const result = document.createElement("p");
    result.textContent = `Limited audit result: ${report.verdict.replaceAll("-", " ")}. No-violation-detected still leaves lower-degree structure unverified.`;
    audit.append(result);
    const findings = document.createElement("ul");
    report.findings.forEach((finding) => {
      const item = document.createElement("li"); item.textContent = `${finding.level.toUpperCase()}: ${finding.message}`; findings.append(item);
    });
    audit.append(findings);
  }
  document.addEventListener("workbook-restored", () => { continueSequence(); stale(); render(); });
  render();
})();
