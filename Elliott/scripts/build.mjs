import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { lessons, stages } from "../course.mjs";
import { referenceHtml } from "../reference.mjs";
import { loadWindows } from "./mt5.mjs";
import { teachingByDay, teachingUnits, validateTeaching } from "../teaching/index.mjs";
import { teachingHtml, questionsHtml, diagramSvg, figureName, glossaryHtml } from "./teaching-html.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const dayName = (day) => `day-${String(day).padStart(2, "0")}.html`;
const list = (items) => `<ol>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ol>`;

function shell({ title, body, prefix = "", day = 0 }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Thirty lessons in Elliott Wave using local XAUUSDm MT5 candles, drawing exercises, and limited rule checks.">
<title>${escape(title)} | Elliott Wave Practice</title><link rel="stylesheet" href="${prefix}assets/style.css">
<script defer src="${prefix}assets/core.js"></script><script defer src="${prefix}assets/chart-data.js"></script><script defer src="${prefix}assets/app.js"></script><script defer src="${prefix}assets/chart-lab.js"></script></head>
<body data-day="${day}"><a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><a class="brand" href="${prefix}index.html">EW <span>GOLD FIELD SCHOOL</span></a><nav aria-label="Main"><a href="${prefix}index.html">Six-stage roadmap</a><a href="${prefix}reference.html">Desk reference</a><button class="quiet" id="export-workbook">Export workbook</button><button class="quiet" id="import-workbook">Import workbook</button><input id="import-file" type="file" accept=".json,application/json" hidden></nav></header>
<div id="notice" class="storage-notice" role="alert" hidden></div><div id="status" class="status" role="status" aria-live="polite"></div>
<main id="main">${body}</main><footer>Local XAUUSDm MT5 data. No live orders. No guaranteed returns. <a href="${prefix}reference.html">Sources &amp; risk boundaries</a></footer></body></html>\n`;
}

function journalTemplate(lesson) {
  return `DAY ${lesson.day}: ${lesson.title}
DATE:
SOURCE: XAUUSDm MT5 export (server timezone offset unknown)
TIMEFRAME / LAST VISIBLE TIMESTAMP:
STUDY MODE: candle analysis / manual historical simulation / demo

BEFORE REVEAL
Observed pivots and their confirmation times:
Parent degree / lower-degree subdivisions:
Primary count or no-count reason:
Alternate / numeric invalidation:
Chosen checker mode / explanation of labels:
What I learned from the worked chart example:

TRADE PLAN (only with verified broker specifications)
Contract size / tick size / account currency conversion:
Trigger / entry / fixed stop / buffer / target / time exit:
Cash risk / volume step / costs / spread price basis:
News source / server-time conversion / eligibility:
First reason to skip:

AFTER REVEAL / REVIEW
Rule-check feedback:
My proposed correction and why (preserve original in exported review):
What still needs human review:
Exit / net R only if supported by execution data:
Quiz answer before opening key:
Daily pass evidence:
Reflection: ${lesson.prompt}
UNIT DELIVERABLE: ${lesson.deliverable}
STAGE MILESTONE EVIDENCE:
`;
}

function lessonBody(lesson, window) {
  const stage = stages.find((item) => item.id === lesson.stageId);
  const teaching = teachingByDay[lesson.day];
  if (!stage) throw new Error(`Day ${lesson.day}: missing curriculum stage`);
  return `<div class="lesson-layout"><aside class="sidebar no-print"><p class="eyebrow">ROADMAP / SIX STAGES</p><h2>Learn. Draw. Defend.</h2><nav aria-label="Daily lessons">${stages.map((group) => `<div class="sidebar-stage">${escape(group.title)} <small>${group.days[0]}-${group.days[1]}</small></div>${lessons.filter((item) => item.stageId === group.id).map((item) => `<a data-progress-day="${item.day}" ${item.day === lesson.day ? 'aria-current="page"' : ""} href="${dayName(item.day)}"><span>${String(item.day).padStart(2, "0")}</span>${escape(item.title)}</a>`).join("")}`).join("")}</nav></aside><article>
<div class="lesson-heading"><p class="eyebrow">DAY ${String(lesson.day).padStart(2, "0")} / 30 &bull; ${escape(lesson.stage)}</p><h1>${escape(lesson.title)}</h1><p class="lesson-title-vi" lang="vi">${escape(teaching.titleVi)}</p><p class="lead">${escape(lesson.goal)}</p><div class="tags"><span>Việt–English</span><span>Learn at your pace</span><span>Historical / demo only</span><span>XAUUSDm ${window.timeframe}</span></div><button class="no-print" id="print-lesson">Print / save PDF</button></div>
<nav class="unit-toc no-print" aria-label="Sections in this lesson"><a href="#deep-principles">Nguyên lý / Principles</a><a href="#illustrated-examples">Hình / Figures</a><a href="#worked-calculation">Ví dụ giải / Walkthrough</a><a href="#chart-lab">Nến thật / Real chart</a><a href="#question-bank">Bài tập / Questions (${teaching.questions.length})</a><a href="#journal">Nhật ký / Journal</a></nav>
<section class="notice">Real candles are evidence, not a guarantee. These are your supplied MT5 exports, not an independently verified live feed. Timezone offset, price basis, and contract specifications are not supplied. No real-money trades.</section>
<section class="unit-contract"><div><p class="eyebrow">TODAY'S OUTPUT</p><p>${escape(lesson.deliverable)}</p></div><div><p class="eyebrow">STAGE ${Math.ceil(lesson.day / 5)} / DAYS ${stage.days[0]}-${stage.days[1]}</p><p>${escape(stage.goal)}</p></div></section>
${teachingHtml(teaching)}
<details class="quick-recap"><summary>Tóm tắt mục tiêu gốc / Original unit recap</summary>${lesson.learn.map((text) => `<p>${escape(text)}</p>`).join("")}</details>
<section><h2>2. Worked example on your real chart</h2><p>${escape(lesson.exampleFocus)}</p><p><strong>Exact source:</strong> ${escape(window.source)}<br><strong>View:</strong> ${window.timeframe}, ${window.bars[0].date} through ${window.bars[window.exampleCutoff - 1].date} (MT5 server time, UTC offset unknown).</p>
<details id="worked-example"><summary>Show worked candle-chart example (keep closed until you try)</summary><p>This is an objective, retrospective swing-drawing demonstration on the first ${window.exampleCutoff} candles. Green/orange candle wicks are original highs/lows. Numbered P marks are confirmed two-bar pivots, <strong>not certified Elliott wave numbers</strong>. Each mark's price and confirmation timestamp are explained below. A second candidate count demonstrates the rule audit, including rejection when appropriate; it is not an answer you must copy.</p><div class="chart-shell"><svg id="example-chart" viewBox="0 0 960 385" role="img" aria-label="Worked XAUUSDm real-candle pivot example"></svg></div><div id="example-explanation"></div><h3>Worked candidate count and correction audit</h3><div class="chart-shell"><svg id="example-count-chart" viewBox="0 0 960 385" role="img" aria-label="Tentative Elliott candidate on real candles, not a certified count"></svg></div><div id="example-count-feedback"></div></details>
${list(lesson.draw)}<p><a href="../reference.html">Desk reference: theory, sizing, and assessment rubric</a>.</p></section>
<section><h2>3. Your real-chart assignment</h2><div class="assignment"><p><strong>Broader study context:</strong> XAUUSDm, ${lesson.window[0]} to ${lesson.window[1]}. ${escape(lesson.timeframe)}</p><p>${escape(lesson.exercise)}</p></div><p>The embedded exercise is a ${window.bars.length}-candle starter slice, not the whole assignment. Where the roadmap asks for 3, 5, 10, or 20 examples, repeat in wider MT5 history, retain separate exports/screenshots, and record the full quota in your journal. One checked drawing does not satisfy a multi-example pass gate.</p></section>
<section id="chart-lab"><h2>4. Draw, test, and submit your count</h2><p><strong>XAUUSDm ${window.timeframe} OHLC</strong> from ${window.bars[0].date} to ${window.bars.at(-1).date}. Labels snap to actual wick highs or lows, never fabricated prices. Future candle prices and extremes are excluded from the practice view and its scaling.</p>
<div class="chart-toolbar no-print"><button id="step-one">Reveal 1 candle</button><button id="step-five">Reveal 5</button><button id="reset-chart" class="quiet">Reset this lab</button></div><p id="replay-status" class="replay-status" aria-live="polite"></p><div class="chart-shell"><svg id="price-chart" viewBox="0 0 960 385" role="img" aria-label="Your XAUUSDm candle chart and Elliott wave drawing"></svg></div>
<details id="context-panel"><summary>Linked Daily / H4 / H1 context at this replay cutoff</summary><p>Only completed bars ending no later than the last revealed practice candle's nominal close are shown. Unknown server timezone is not converted. This is raw context, not an automatic parent/subwave count. Each pane shows at most the latest 96 available completed bars; lower-timeframe coverage may span only part of the parent leg.</p><div id="linked-context"></div></details>
<div class="label-controls no-print"><label for="wave-label">Label</label><select id="wave-label"></select><label for="wick-anchor">Wick</label><select id="wick-anchor"><option value="low">Low</option><option value="high">High</option></select><label for="observation-select">Visible candle</label><select id="observation-select"></select><button id="add-mark">Add endpoint</button><button id="undo-mark" class="quiet">Undo endpoint</button><label><input id="auto-next" type="checkbox" checked> Auto-next label &amp; alternate wick</label></div>
<p class="caption">Choose a checker mode, the first label, and the starting wick (low for a bullish start, high for bearish), then click candles chronologically or use Add endpoint. Auto-next advances 0-1-2-3-4-5 or 0-A-B-C and alternates high/low; switch it off for manual labels. Undo and redraw to revise. The example never overwrites your drawing.</p>
<div class="label-controls no-print"><label for="check-mode">Check as</label><select id="check-mode"><option value="swings">Observed swings (no pattern claim)</option><option value="impulse">Standard impulse: 0-1-2-3-4-5</option><option value="zigzag">Zigzag candidate: 0-A-B-C</option><option value="flat">Flat candidate: 0-A-B-C</option><option value="triangle">Triangle candidate: 0-A-B-C-D-E</option></select><button id="check-count">Check my count</button><button id="export-review" class="quiet">Export review JSON</button><button id="export-chart" class="quiet">Download drawn chart SVG</button></div>
<div id="count-feedback" class="pass-gate" aria-live="polite">Draw your endpoints, choose a checker mode, then select Check my count.</div>
${lesson.measurement !== "none" ? `<div class="measurement-panel"><h3>Measure your own wick anchors</h3><p>Add two endpoints for retracement levels, three for extensions, or six for proposed 1/3/5 relationships. This uses your selected anchors even if the wave interpretation is invalid. It never certifies the count.</p><button id="measure-anchors" class="no-print">Measure my anchors</button><div id="measurement-results" aria-live="polite"></div></div>` : ""}
${lesson.day === 24 ? `<form id="risk-calculator" class="measurement-panel"><h3>Verified-specification sizing worksheet</h3><p>No broker defaults. Costs are total modeled loss-side costs per lot in account currency. Conversion is account-currency units per USD. Blank specifications mean no calculation, not permission to guess. Result is a hypothetical planned risk, not a maximum possible loss.</p>${[["equity","Account equity"],["riskPercent","Risk (%)"],["distance","Stop distance (USD/oz)"],["contract","Verified ounces per lot"],["conversion","Account currency per USD"],["costs","Modeled costs per lot"],["step","Verified lot step"]].map(([name,text]) => `<label>${text}<input required type="number" name="${name}" step="any" min="${name === "costs" ? "0" : "0.00000001"}" ${name === "riskPercent" ? 'max="100"' : ""}></label>`).join("")}<button type="submit">Calculate planned size</button><div id="risk-result" role="status"></div></form>` : ""}
<p><strong>Detailed correction from me:</strong> export the review JSON and optionally the drawn chart SVG, then attach them in this chat with the day number. Or save and share this browser page, then tell me to review it. The JSON includes the exact visible candles, wick endpoints, timestamps, checker feedback, and your journal. Nothing is sent automatically; the offline checker is not an AI tutor. I can challenge the count, explain broken rules, and suggest an alternative with uncertainty, not promise a unique correct count.</p>
<details><summary>Visible OHLC and my labels</summary><div class="table-wrap"><table><thead><tr><th>MT5 timestamp</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>My labels</th></tr></thead><tbody id="visible-data"></tbody></table></div></details>
<p class="caption">Data: ${escape(window.source)}. File hash/window identity is included in backups so labels cannot silently attach to a different dataset. No resampling, timezone conversion, or fabricated candles. OHLC cannot establish every intrabar fill sequence.</p></section>
${questionsHtml(teaching)}
<section><h2>Kiểm tra thêm / Extra checkpoint</h2><p><strong>Closed-book question:</strong> ${escape(lesson.quiz)}</p><details class="answer-key"><summary>Answer key: open after writing your answer</summary><p>${escape(lesson.answer)}</p><p>Use both the exact rule screen and contextual human review. No-violation-detected is not a verified count or a pass for the whole unit.</p></details></section>
<section><h2>6. Deliver, review &amp; pass</h2><div class="pass-gate"><strong>Today's pass gate</strong><p>${escape(lesson.gate)}</p><strong>Submit:</strong><p>${escape(lesson.deliverable)}</p></div>${lesson.day % 5 === 0 ? `<div class="stage-milestone"><p class="eyebrow">STAGE ${Math.ceil(lesson.day / 5)} CHECKPOINT</p><h3>${escape(stage.title)}</h3><p>${escape(stage.milestone)}</p><p>Record evidence before continuing. Repeat weak tasks; a profitable outcome does not excuse broken rules.</p></div>` : ""}<p>${escape(lesson.prompt)}</p><label for="journal">Daily workbook</label><textarea id="journal" maxlength="100000">${escape(journalTemplate(lesson))}</textarea><div class="journal-actions no-print"><button id="save-journal">Save journal</button><label class="complete-toggle"><input id="complete-day" type="checkbox"> I met the pass gate and deliverable</label><span id="journal-status" role="status"></span></div></section>
<nav class="day-pagination" aria-label="Lesson navigation"><a href="${lesson.day > 1 ? dayName(lesson.day - 1) : "../index.html"}">&larr; ${lesson.day > 1 ? "Day " + (lesson.day - 1) : "Roadmap"}</a><a href="${lesson.day < 30 ? dayName(lesson.day + 1) : "../index.html"}">${lesson.day < 30 ? "Day " + (lesson.day + 1) : "Roadmap"} &rarr;</a></nav></article></div>`;
}

function home() {
  return `<section class="hero"><p class="eyebrow">VIỆT–ENGLISH &bull; SIX STAGES &bull; REAL XAUUSDm DATA</p><h1>Hiểu nguyên lý.<br>Draw with reasons.</h1><p class="lead">Giáo trình song ngữ: giải thích sâu, hình minh họa có chú thích, ví dụ giải từng bước và bài tập có lời giải. Thirty illustrated units following your roadmap, with real-gold candle practice and saved written responses.</p><a class="button" href="days/day-01.html">Bắt đầu / Begin day 01 &rarr;</a><a class="secondary-link" href="Roadmap.md">Read your source roadmap</a><div class="hero-stats"><div><strong>${teachingUnits.reduce((sum, unit) => sum + unit.principles.length, 0)}</strong><span>bilingual principle explanations</span></div><div><strong>${teachingUnits.reduce((sum, unit) => sum + unit.figures.length, 0)}</strong><span>original annotated diagrams</span></div><div><strong>${teachingUnits.reduce((sum, unit) => sum + unit.questions.length, 0)}</strong><span>questions with worked answers</span></div></div></section>
<section class="notice"><h2>Same gold data. A new learning sequence.</h2><p>Your roadmap's lesson order and quotas are retained; its currency-pair examples are adapted to your supplied XAUUSDm MT5 candles. Price distances are USD per ounce, not assumed forex pips. Clearer terminology and risk qualifications do not change the learning objectives. Thirty days is a foundation, not professional certification or guaranteed profits.</p></section>
<section class="start-grid"><div><p class="eyebrow">HOW EACH UNIT WORKS</p><h2>Study &rarr; example &rarr; draw &rarr; test &rarr; deliver</h2><p>Learn the unit's principle, inspect a topic-specific worked example, draw your own count, use the limited rule and measurement tools, then export the work for review here. For multi-timeframe units, inspect linked Daily/H4/H1 candles at the same replay cutoff.</p><p>A starter slice cannot supply every required example. Repeat the stated quotas in wider MT5 history and retain evidence. No-count and insufficient-data outcomes are allowed; invented examples are not.</p></div><div><p class="eyebrow">REDESIGNED WORKBOOK</p><h2 id="progress-summary">0 of 30 days complete</h2><progress id="course-progress" max="30" value="0">0/30</progress><p>New lesson meanings use a separate Roadmap workbook. Previous notes and drawings remain in browser storage untouched; old completion is not counted toward different lessons.</p><button id="export-previous" class="quiet">Export previous gold workbook</button><p class="caption">Exports the old records unchanged if present on this browser origin. Do not import them as new-day answers. The current Export workbook button backs up the redesigned course.</p></div></section>
<nav class="stage-jump" aria-label="Six stages">${stages.map((stage, i) => `<a href="#stage-${stage.id}"><span>0${i + 1}</span>${escape(stage.title)}<small>Days ${stage.days[0]}-${stage.days[1]}</small></a>`).join("")}</nav>
${stages.map((stage, i) => `<section id="stage-${stage.id}" class="stage-section"><div class="stage-heading"><p class="eyebrow">STAGE 0${i + 1} / DAYS ${stage.days[0]}-${stage.days[1]}</p><h2>${escape(stage.title)}</h2><p>${escape(stage.goal)}</p></div><div class="roadmap">${lessons.filter((lesson) => lesson.stageId === stage.id).map((lesson) => `<a class="day-card" data-progress-day="${lesson.day}" href="days/${dayName(lesson.day)}"><div class="card-meta"><span>DAY ${String(lesson.day).padStart(2, "0")}</span><span>${lesson.labTimeframe} / XAUUSDm</span></div><h3 lang="vi">${escape(teachingByDay[lesson.day].titleVi)}</h3><p lang="en"><strong>${escape(lesson.title)}</strong></p><p>${escape(lesson.goal)}</p><div class="card-output"><strong>Deliver:</strong> ${escape(lesson.deliverable)}</div><span class="card-link">Học, vẽ &amp; kiểm tra / Study &amp; review &rarr;</span></a>`).join("")}</div><div class="stage-milestone"><strong>Stage checkpoint</strong><p>${escape(stage.milestone)}</p></div></section>`).join("")}
<section><p><a href="README.md">Course instructions, preservation and data limits</a> &middot; <a href="reference.html">Pattern desk and final exam rubric</a></p></section>`;
}

export function build() {
  validateTeaching();
  if (lessons.length !== 30 || stages.length !== 6) throw new Error("The roadmap requires thirty units and six stages.");
  for (const lesson of lessons) {
    if (!lesson.deliverable || !lesson.exampleFocus || !["Daily", "H4", "H1"].includes(lesson.labTimeframe) || !["swings", "impulse", "zigzag", "flat", "triangle"].includes(lesson.checkMode) || !["none", "retracement", "extension", "relationships", "confluence"].includes(lesson.measurement)) {
      throw new Error(`Day ${lesson.day}: incomplete roadmap teaching/lab metadata`);
    }
  }
  const bundle = loadWindows(root, lessons);
  mkdirSync(resolve(root, "assets/figures"), { recursive: true });
  for (const unit of teachingUnits) for (const [index, figure] of unit.figures.entries()) writeFileSync(resolve(root, "assets/figures", figureName(unit.day, index)), diagramSvg(unit.day, figure, index));
  mkdirSync(resolve(root, "days"), { recursive: true });
  for (const lesson of lessons) writeFileSync(resolve(root, "days", dayName(lesson.day)), shell({ title: `Day ${lesson.day}: ${lesson.title}`, day: lesson.day, prefix: "../", body: lessonBody(lesson, bundle.windowsByDay[lesson.day]) }));
  writeFileSync(resolve(root, "assets/chart-data.js"), `// Generated from user-supplied MT5 exports. Source identity is retained per window.\nglobalThis.ElliottData = ${JSON.stringify(bundle)};\n`);
  writeFileSync(resolve(root, "legacy-index.html"), shell({ title: "Legacy XAUUSD 30-day course", body: home() }));
  writeFileSync(resolve(root, "reference.html"), shell({ title: "Gold desk reference", body: `<article class="reference"><h1>The gold counting &amp; risk desk</h1><p class="lesson-title-vi" lang="vi">Bàn tra cứu nguyên lý, thuật ngữ và rủi ro</p><button id="print-lesson" class="no-print">Print / save PDF</button>${glossaryHtml}${referenceHtml}</article>` }));
  console.log("Built 30 XAUUSD MT5 candle lessons, worked chart examples, and drawing labs.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
