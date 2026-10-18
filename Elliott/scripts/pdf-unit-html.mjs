import { diagramSvg } from "./teaching-html.mjs";
import { sourceLesson } from "../teaching/pdf-source-lessons.mjs";

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
export const pdfDataset = "xauusd-pdf-v1";
export const unitFile = (day) => `unit-${String(day).padStart(2, "0")}.html`;

const modes = [
  "swings", "swings", "swings", "impulse", "impulse",
  "impulse", "impulse", "swings", "swings", "impulse",
  "zigzag", "flat", "flat", "triangle", "swings",
  "swings", "swings", "swings", "swings", "impulse",
  "swings", "impulse", "impulse", "swings", "impulse",
  "zigzag", "swings", "swings", "swings", "swings"
];

export function labLessons(units) {
  return units.map((unit) => {
    const year = unit.day <= 18 ? 2023 : 2024;
    const month = (unit.day - 1) % 12 + 1;
    return {
      day: unit.day, window: [`${year}-${String(month).padStart(2, "0")}-01`, `${year}-${String(Math.min(12, month + 2)).padStart(2, "0")}-28`],
      labTimeframe: [3, 21, 30].includes(unit.day) ? "Daily" : unit.day >= 23 && unit.day <= 27 ? "H1" : "H4",
      checkMode: modes[unit.day - 1], measurement: unit.day >= 18 ? "confluence" : "none",
      exampleKind: [8, 9].includes(unit.day) ? "diagonal" : unit.day === 16 ? "complex" : "pivots"
    };
  });
}

export function validateQuizzes(quizzes) {
  if (Object.keys(quizzes).length !== 30) throw new Error("Expected quizzes for all 30 units.");
  for (let day = 1; day <= 30; day++) {
    if (!Array.isArray(quizzes[day]) || quizzes[day].length !== 6) throw new Error(`Unit ${day}: expected six MCQs.`);
    for (const question of quizzes[day]) {
      if (typeof question.prompt !== "string" || question.prompt.length < 25 || typeof question.explanation !== "string" || question.explanation.length < 45 || !Array.isArray(question.options) || question.options.length < 3 || question.options.length > 4 || question.options.some((option) => typeof option !== "string" || !option.trim()) || new Set(question.options).size !== question.options.length || !Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length) throw new Error(`Unit ${day}: invalid question or explanation.`);
    }
  }
}

export function chartLabHtml(window) {
  return `<div class="chart-toolbar"><button id="step-one">Mở 1 nến / Reveal 1</button><button id="step-five">Mở 5 nến</button><button id="reset-chart" class="quiet">Vẽ lại / Reset</button></div>
<p id="replay-status" aria-live="polite"></p><div class="chart-shell"><svg id="price-chart" viewBox="0 0 960 385" role="img" aria-label="XAUUSDm real candle drawing exercise"></svg></div>
${window.unit === 22 ? '<h3>RSI(14) Wilder — close</h3><div class="chart-shell"><svg id="rsi-chart" viewBox="0 0 960 200" role="img" aria-label="RSI14 calculated from original closes at the visible cutoff"></svg></div><p class="caption">RSI dùng 200 nến trước cửa sổ để warm-up; chỉ hiển thị giá trị đến nến đang thấy. So sánh cùng timestamp; divergence không chứng nhận count.</p>' : ""}
<div class="label-controls"><label for="wave-label">Nhãn / Label</label><select id="wave-label"></select><label for="wick-anchor">Râu nến / Wick</label><select id="wick-anchor"><option value="low">Low</option><option value="high">High</option></select><label for="observation-select">Nến / Candle</label><select id="observation-select"></select><button id="add-mark">Thêm điểm / Add</button><button id="undo-mark" class="quiet">Undo</button><label><input id="auto-next" type="checkbox" checked>Tự chuyển nhãn &amp; high/low</label></div>
<p>Chọn wick bắt đầu (low cho nhịp tăng, high cho giảm), rồi bấm lần lượt trên chart hoặc chọn nến và “Thêm điểm”. Tắt tự chuyển nhãn khi vẽ W–X–Y, nhiều degree hoặc swing riêng. Giá neo đúng wick thật, không kéo đến giá tùy ý.</p>
<div class="label-controls"><label for="check-mode">Phạm vi kiểm tra / Mode</label><select id="check-mode"><option value="swings">Swings — không chứng nhận pattern</option><option value="impulse">Standard impulse 0–1–2–3–4–5</option><option value="zigzag">Zigzag 0–A–B–C</option><option value="flat">Flat 0–A–B–C</option><option value="triangle">Triangle 0–A–B–C–D–E — thứ tự/chân</option></select><button id="check-count">Kiểm tra nét vẽ / Check</button></div>
<div id="count-feedback" class="pass-gate" aria-live="polite">Vẽ trước rồi kiểm tra. Checker không tự chấm internals, degree hoặc toàn bộ bài học.</div>
<p><strong>Giới hạn:</strong> diagonal, complex/running/expanding triangle và policy giao dịch cần nhận xét thủ công; dùng swings thay vì ép chúng qua checker impulse. Mode triangle chỉ kiểm tra nhãn/thứ tự và các chân quan sát, không chứng nhận hình học, biến thể hay internals. Chưa biết executable bid/ask, timezone offset hoặc broker specs. OHLC không chứng minh fill hay lợi nhuận.</p>
<details><summary>Daily / H4 / H1 cùng mốc quan sát</summary><div id="linked-context"></div></details>
<div class="measurement-panel"><h3>Đo các điểm đã chọn / Measure anchors</h3><p>2 điểm: retracement; 3 điểm: projection; 6 điểm: độ dài 1/3/5. Không dùng kết quả đo để cứu count sai.</p><button id="measure-anchors">Đo / Measure</button><div id="measurement-results" aria-live="polite"></div></div>
${window.unit === 24 ? `<form id="risk-calculator" class="measurement-panel"><h3>Risk worksheet — không điền sẵn broker specs</h3>${[["equity", "Equity"], ["riskPercent", "Risk %"], ["distance", "Stop distance USD/oz"], ["contract", "Verified oz/lot"], ["conversion", "Account currency per USD"], ["costs", "Modeled costs per lot"], ["step", "Verified volume step"]].map(([name, label]) => `<label>${label}<input required type="number" name="${name}" min="${name === "costs" ? 0 : 0.00000001}" step="any"${name === "riskPercent" ? ' max="100"' : ""}></label>`).join("")}<button type="submit">Tính / Calculate</button><div id="risk-result" role="status"></div></form>` : ""}
<div class="journal-actions"><button id="export-review">Xuất bài vẽ + trả lời JSON</button><button id="export-chart" class="quiet">Tải nét vẽ SVG</button></div>
<p>Gửi JSON và SVG vào chat để được nhận xét. Không tự upload. JSON gồm đúng nến đang thấy, endpoints, journal và câu trả lời; giữ bản gốc trước khi sửa.</p>
<details><summary>OHLC và các nhãn đã vẽ</summary><div class="table-wrap"><table><thead><tr><th>Timestamp</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Labels</th></tr></thead><tbody id="visible-data"></tbody></table></div></details>
<details><summary>Ví dụ pivot quan sát — không phải đáp án bài vẽ</summary><p>Các P-pivot và candidate bên dưới được chọn hậu nghiệm trong 48 nến đầu, không chứng nhận đúng pattern của unit này. Giữ đóng cho đến khi bạn tự vẽ.</p><div class="chart-shell"><svg id="example-chart" viewBox="0 0 960 385" role="img" aria-label="Observed retrospective pivots"></svg></div><div id="example-explanation"></div><div class="chart-shell"><svg id="example-count-chart" viewBox="0 0 960 385" role="img" aria-label="Tentative retrospective candidate, not a certified answer"></svg></div><div id="example-count-feedback"></div></details>`;
}

const schematics = [
  [2300,2340,2320,2390,2350,2410,2370,2390,2345], [2300,2320,2310,2340,2325],
  [2320,2360,2340,2410,2380,2440], [2300,2340,2320,2390,2350,2410], [2300,2340,2320,2390,2350,2410],
  [2320,2360,2340,2410,2380,2440], [2320,2360,2340,2410,2380,2440],
  [2300,2360,2320,2370,2340,2380], [2300,2360,2320,2370,2340,2380], [2300,2340,2320,2390,2350,2410],
  [2400,2340,2370,2310], [2400,2350,2396,2345], [2400,2350,2420,2330],
  [2400,2340,2385,2350,2380,2360], [2400,2340,2410,2355,2400,2370],
  [2400,2350,2380,2330], [2400,2350,2396,2345], [2300,2400,2350],
  [2300,2400,2350,2450], [2300,2340,2320,2390,2350,2410], [2300,2400,2350,2398],
  [2300,2380,2350,2400], [2300,2400,2350], [2300,2310,2305],
  [2320,2390,2350,2370], [2400,2340,2370,2310], [2300,2400,2350], [2300,2400,2350], [2300,2400,2350], [2300,2340,2320,2390,2350,2410]
];

export function conceptSvg(day) {
  const points = schematics[day - 1];
  const labels = day === 1 ? ["0","1","2","3","4","5","A","B","C"]
    : [11,12,13,17,26].includes(day) ? ["0","A","B","C"]
    : [14,15].includes(day) ? ["0","A","B","C","D","E"]
    : day === 16 ? ["0","W","X","Y"] : points.map((_, index) => `P${index}`);
  return diagramSvg(day, { points, labels, titleEn: `Unit ${day}: observe prices before interpreting labels`, en: "Original hypothetical price skeleton for this unit. Read the unit's numerical example and compare anchors. This drawing is neither real candles nor proof of subdivisions, degree, risk or execution. P labels are observations, not Elliott wave numbers." }, 0);
}

export function sourceLessonHtml(day) {
  const { figure, comparisonFigure, observe, principle, limitation, questions } = sourceLesson(day);
  const [,, width, height] = figure.crop;
  return `<section id="source-lesson"><h2>Đọc hình gốc &amp; trả lời trên chart / Source-chart lesson</h2>
<p><strong>${escape(figure.title)}</strong> · Steve Sinclair, <cite>Elliott Waves Made Simple</cite>, Image ${figure.image}, PDF p.${figure.page}. <a href="../${figure.source}#page=${figure.page}">Mở trang gốc / Original page</a></p>
<ol><li><strong>Quan sát / Observe:</strong> ${escape(observe)}</li><li><strong>Suy luận / Reason:</strong> ${escape(principle)}</li><li><strong>Giới hạn / Limit:</strong> ${escape(limitation)}</li></ol>
${comparisonFigure ? `<figure><img src="source-figures/${comparisonFigure.id}.png" width="${comparisonFigure.crop[2] * 3}" height="${comparisonFigure.crop[3] * 3}" alt="Expanded flat: C vượt đáy A, khác running flat trong hai câu hỏi."><figcaption>So sánh / Compare: Steve Sinclair, Image ${comparisonFigure.image}, <a href="../${comparisonFigure.source}#page=${comparisonFigure.page}">PDF p.${comparisonFigure.page}</a>. Expanded flat có C vượt đáy A; running flat ở dưới thì không. / Compare C with A; a B overshoot alone does not distinguish the two.</figcaption></figure>` : ""}
<p>Ảnh trích từ PDF bạn cung cấp, giữ nhãn gốc để học cách đọc; không phải dữ liệu MT5 của lab. Bấm vào <strong>điểm giá/đỉnh/đáy</strong> được hỏi (không bấm chữ nhãn), rồi “Kiểm tra”. Mỗi câu có hình riêng để lưu hai điểm độc lập. / Click the requested endpoint, not the label text; each question has its own saved point.</p>
${questions.map((question) => `<div class="source-exercise"><h3>Câu hình ${question.slot - 10} / Image question ${question.slot - 10}</h3><p>${escape(question.prompt)}</p>
<svg class="source-question-chart" viewBox="0 0 1000 1000" preserveAspectRatio="none" style="aspect-ratio:${width} / ${height}" role="img" aria-label="${escape(question.prompt)}"><image href="source-figures/${figure.id}.png" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/></svg>
<script type="application/json" class="source-exercise-config">${JSON.stringify(question).replace(/</g, "\\u003c")}</script>
<input type="hidden" data-question="${question.slot}" class="source-answer">
<div class="source-coordinate-controls"><label>X (0–1000)<input class="source-x" type="number" min="0" max="1000" step="any"></label><label>Y (0–1000)<input class="source-y" type="number" min="0" max="1000" step="any"></label><button class="source-place" type="button">Đặt điểm / Place</button><button class="source-check" type="button">Kiểm tra / Check</button><button class="source-clear quiet" type="button">Xóa điểm / Clear</button></div>
<p class="source-chart-feedback" role="status">Chưa chọn điểm / No point selected.</p></div>`).join("")}
<p class="caption">Chấm tọa độ trong vùng dung sai quanh endpoint được hỏi, không tự xác nhận cấu trúc Elliott hay hiệu quả giao dịch. Dùng trường X/Y nếu không thao tác chuột; gốc tọa độ ở góc trên trái. Lưu trả lời hoặc export để giữ điểm, lời giải và nguồn hình.</p></section>`;
}

export function unitPage(unit, window, questions, { shell, markdownHtml }) {
  const day = unit.day;
  const field = (name) => {
    for (const line of unit.body.split("\n")) {
      const match = line.match(/^- \*\*(.+?):\*\* (.+)$/);
      if (match && (match[1] === name || match[1].startsWith(`${name},`))) return match[2];
    }
    return undefined;
  };
  const required = ["Nguyên lý", "Ví dụ mới", "XAUUSD", "Bài tập", "Đáp án định hướng"];
  for (const name of required) if (!field(name)) throw new Error(`Unit ${day}: missing ${name}`);
  const quiz = questions.map((question, index) => `<fieldset class="mcq" data-correct="${question.correct}"><legend>${index + 1}. ${escape(question.prompt)}</legend>${question.options.map((option, choice) => `<label><input type="radio" name="quiz-${index + 1}" value="${choice}"> ${escape(option)}</label>`).join("")}<input type="hidden" data-question="${index + 1}" value=""><p class="quiz-feedback" role="status"></p><p class="quiz-explanation" hidden>${escape(question.explanation)}</p></fieldset>`).join("");
  const writing = [
    ["7", `Bài vẽ chính / Main drawing: ${field("XAUUSD")}`],
    ["8", `Giải thích bằng evidence / Explain with evidence: ${field("Bài tập")}`],
    ["9", "Chọn một cách diễn giải thay thế hoặc no-count. Ghi timestamp/giá làm bác bỏ primary, và phần cần kiểm tra thủ công. / Record an alternate or no-count, exact invalidation and unverified evidence."],
    ["10", "Sau khi mở thêm nến, ghi nhãn nào cần sửa và tại sao; giữ bản gốc. Nếu có trade plan, nêu thông tin còn thiếu và lý do no-trade. / Review changes without hindsight; document missing inputs and no-trade criteria."]
  ].map(([id, prompt]) => `<label class="written-question" for="answer-${id}">${escape(prompt)}<textarea id="answer-${id}" data-question="${id}" rows="4" maxlength="12000"></textarea></label>`).join("");
  const lessonOutline = markdownHtml(unit.body.replace(/^- \*\*Đáp án định hướng:\*\* .+\n?/m, ""), "Roadmap.md").replace(/href="(?![a-z][a-z\d+.-]*:|#|\/)([^"]+)"/gi, 'href="../$1"');
  const content = `<article class="published-document"><p class="eyebrow">PDF CURRICULUM · UNIT ${String(day).padStart(2, "0")} / 30</p><h1>${escape(unit.title)}</h1><p class="lead">${escape(unit.goal)}</p>
<nav class="unit-toc" aria-label="Trong bài"><a href="#learn">Học &amp; ví dụ</a><a href="#source-lesson">Hình PDF + câu hỏi trên chart</a><a href="#quiz">Trắc nghiệm</a><a href="#chart-lab">Tự vẽ XAUUSD</a><a href="#responses">Bài nộp</a></nav>
<p><a href="../index.html">← Roadmap</a> ${day > 1 ? `· <a href="${unitFile(day-1)}">Unit trước</a>` : ""} ${day < 30 ? `· <a href="${unitFile(day+1)}">Unit tiếp</a>` : ""}</p>
<div id="notice" class="storage-notice" role="alert" hidden></div><div id="status" role="status"></div>
<section id="learn"><h2>1. Học và ví dụ theo unit / Study</h2>${lessonOutline}
${sourceLessonHtml(day)}
<details><summary>Sơ đồ giả định bổ sung / Additional synthetic sketch</summary><img src="figures/unit-${String(day).padStart(2, "0")}-concept.svg" width="960" height="480" alt="Sơ đồ giả định cho unit ${day}; không phải nến thật hoặc count được xác nhận."><p class="caption">Sơ đồ giá giả định: đọc cùng ví dụ của bài. P là điểm quan sát, không là số sóng Elliott. Không mô tả RSI, contract size hoặc kết quả giao dịch từ đường giá này.</p></details>
${day === 4 ? `<details><summary>Bốn nguyên lý và 10 câu tự luận của bài mẫu chi tiết</summary><a href="unit-04-reading.html">Mở bài đọc unit 04 đầy đủ có hình đúng/sai</a></details>` : ""}
<p><a href="../roadmap.html#3-quy-ước-và-điểm-cần-đọc-có-phản-biện">Quy tắc, guideline và lưu ý nguồn</a> · <a href="../unit-structure.html">Cách làm và rubric bài vẽ</a></p></section>
<section id="quiz"><h2>2. Trắc nghiệm / Multiple-choice practice</h2><p>6 câu chọn đáp án, có giải thích sau khi chấm; 4 nhiệm vụ tự luận/vẽ bên dưới. Đây là luyện tập offline, không phải bài thi chống xem đáp án.</p>${day === 30 ? "<p>Checkpoint này dùng để ôn trước capstone; không thay thế bộ 20 câu và hồ sơ đa khung được yêu cầu trong roadmap. Bài thi độc lập cần được giao/chấm riêng, không lấy điểm 6 câu này làm chứng nhận hoàn tất khóa học.</p>" : ""}${quiz}<button id="grade-quiz">Chấm trắc nghiệm / Grade</button><p id="quiz-score" role="status">Chưa chấm / Not graded.</p></section>
<section id="chart-lab"><h2>3. Bài vẽ của unit ${day} / Draw here</h2><div class="assignment"><p><strong>Nhiệm vụ:</strong> ${escape(field("XAUUSD"))}</p><p><strong>Giải thích cần nộp:</strong> ${escape(field("Bài tập"))}</p></div>
<p><strong>Starter window:</strong> XAUUSDm ${window.timeframe}, ${window.bars[0].date} → ${window.bars.at(-1).date}. Ban đầu 48/${window.bars.length} nến. Cửa sổ có thể không chứa pattern yêu cầu; ghi no-count và dùng lịch sử rộng hơn, không ép nhãn để đạt quota.</p><p class="caption">${escape(window.source)} · server-time offset unknown · không resample. Từng unit có nguồn/window identity riêng.</p>${chartLabHtml(window)}</section>
<section id="responses"><h2>4. Tự luận, nộp bài và sửa / Written review</h2>${writing}<details><summary>Tiêu chí tự đối chiếu — làm trước khi mở</summary><p>${escape(field("Đáp án định hướng"))}</p><p>Đối chiếu đúng source, wick và cutoff; kiểm tra hard rules; alternatives/internals có thể cần người đọc chart. Không chấm bài vẽ bằng điểm trắc nghiệm hoặc hướng giá sau đó.</p></details><button id="save-responses">Lưu trả lời / Save responses</button><p id="responses-status" role="status"></p>
<label for="journal">Nhật ký / Journal — ghi nguồn, endpoints, degree, invalidation và sửa đổi</label><textarea id="journal" rows="9" maxlength="100000">UNIT ${day}: ${escape(unit.title)}\nSOURCE / CUTOFF:\nENDPOINT TABLE:\nPRIMARY / ALTERNATE / NO-COUNT:\nINVALIDATION:\nUNVERIFIED EVIDENCE:\nBEFORE REVEAL:\nAFTER REVEAL / CHANGES:\n</textarea><button id="save-journal">Lưu nhật ký &amp; trả lời</button><p id="journal-status" role="status"></p>
<p class="pass-gate"><strong>Đạt bài:</strong> ${escape(unit.deliverable)}. Trắc nghiệm ≥5/6 chỉ là checkpoint; 4 bài tự luận/vẽ cần đánh giá theo rubric (≥16/20, không lỗi nghiêm trọng), không tự chứng nhận hoàn thành.</p><label><input type="checkbox" id="complete-day"> Tôi đã đối chiếu rubric và nhận xét cần thiết / Self-record completion</label>
<div class="journal-actions"><button id="export-workbook">Export workbook PDF course</button><button id="import-workbook" class="quiet">Import matching workbook</button><input id="import-file" type="file" accept=".json,application/json" hidden><button id="print-lesson" class="quiet">In / PDF</button></div><p>Workbook mới tách biệt khóa cũ. Lưu câu trả lời trước khi rời bài; lỗi lưu sẽ hiện rõ, hãy export nếu browser không lưu được.</p></section></article>`;
  return shell(`Unit ${day}: ${unit.title}`, content, "../", day);
}
