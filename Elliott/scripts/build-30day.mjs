import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildUnitSample } from "./build-unit-sample.mjs";
import { loadWindows, parseMt5 } from "./mt5.mjs";
import { conceptSvg, labLessons, pdfDataset, unitFile, unitPage } from "./pdf-unit-html.mjs";
import { quizzes } from "../teaching/pdf-quizzes.mjs";
import { sourceLesson, sourceFigures } from "../teaching/pdf-source-lessons.mjs";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path === "Roadmap.md" ? "roadmap-30day.md" : path === "Unit-structure.md" ? "unit-structure-30day.md" : path), "utf8");
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
const published = new Map([
  ["Roadmap.md", "roadmap.html"],
  ["Unit-structure.md", "unit-structure.html"],
  ["units/unit-04.md", "units/unit-04-reading.html"]
]);

function localLink(target, source) {
  if (/^(?:https?:|#)/.test(target)) return target;
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) throw new Error(`Unsupported link: ${target}`);
  const [path, fragment] = target.split("#");
  const absolute = resolve(root, dirname(source), path);
  for (const [markdown, html] of published) {
    if (absolute === resolve(root, markdown)) {
      const prefix = source.startsWith("units/") ? "../" : "";
      return prefix + html + (fragment ? `#${fragment}` : "");
    }
  }
  return target;
}

function inline(text, source) {
  const tokens = [];
  const token = (html) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };
  let result = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${escape(code)}</code>`));
  result = result.replace(/(!?)\[([^\]]*)\]\(([^)]+)\)/g, (_, image, label, target) => {
    const url = escape(localLink(target, source));
    return token(image
      ? `<img src="${url}" alt="${escape(label)}" loading="lazy" width="960" height="480">`
      : `<a href="${url}">${escape(label)}</a>`);
  });
  result = escape(result).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return result.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

// A deliberately small renderer for the Markdown constructs used by these local course documents.
export function markdownHtml(markdown, source) {
  const lines = markdown.split(/\r?\n/);
  const output = [], ids = new Map();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (line.startsWith("```")) {
      const code = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index === lines.length) throw new Error(`${source}: unclosed code fence`);
      index++;
      output.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
    } else if (/^<\/?details>$/.test(line)) {
      output.push(line);
      index++;
    } else if (/^<summary>.*<\/summary>$/.test(line)) {
      output.push(`<summary>${inline(line.slice(9, -10), source)}</summary>`);
      index++;
    } else if (/^#{1,6} /.test(line)) {
      const [, hashes, title] = line.match(/^(#{1,6}) (.*)$/);
      const base = slug(title), count = ids.get(base) || 0;
      ids.set(base, count + 1);
      const id = base + (count ? `-${count}` : "");
      output.push(`<h${hashes.length} id="${escape(id)}">${inline(title, source)}</h${hashes.length}>`);
      const unitHeading = source === "Roadmap.md" && hashes.length === 4 ? title.match(/^Day (\d\d) —/) : null;
      if (unitHeading) output.push(`<p><a class="button" href="units/unit-${unitHeading[1]}.html">Học &amp; thực hành unit ${unitHeading[1]} — trắc nghiệm + vẽ chart</a></p>`);
      index++;
    } else if (line.startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        rows.push(lines[index++].split("|").slice(1, -1).map((cell) => cell.trim()));
      }
      if (rows.length < 2 || !rows[1].every((cell) => /^:?-+:?$/.test(cell))) throw new Error(`${source}: invalid table`);
      const row = (cells, tag) => `<tr>${cells.map((cell) => `<${tag}>${inline(cell, source)}</${tag}>`).join("")}</tr>`;
      output.push(`<div class="table-wrap"><table><thead>${row(rows[0], "th")}</thead><tbody>${rows.slice(2).map((cells) => row(cells, "td")).join("")}</tbody></table></div>`);
    } else if (/^(?:- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line), rows = [];
      const pattern = ordered ? /^\d+\. (.*)$/ : /^- (.*)$/;
      while (index < lines.length && pattern.test(lines[index])) {
        rows.push(`<li>${inline(lines[index++].match(pattern)[1], source)}</li>`);
      }
      output.push(`<${ordered ? "ol" : "ul"}>${rows.join("")}</${ordered ? "ol" : "ul"}>`);
    } else {
      const paragraph = [line];
      index++;
      while (index < lines.length && lines[index].trim() && !/^(?:#{1,6} |```|\||- |\d+\. |<\/?(?:details|summary)>)/.test(lines[index])) paragraph.push(lines[index++]);
      output.push(`<p>${inline(paragraph.join("\n"), source).replace(/ {2}\n/g, "<br>")}</p>`);
    }
  }
  return output.join("\n");
}

export function parseRoadmap(markdown) {
  const stages = [];
  let stage;
  for (const block of markdown.split(/(?=^### Giai đoạn |^#### Day )/m).slice(1)) {
    if (block.startsWith("### Giai đoạn ")) {
      const match = block.match(/^### Giai đoạn (\d+) — (.+) \/ Days (\d+)–(\d+)/);
      if (!match) throw new Error("Invalid roadmap stage heading");
      stage = { number: Number(match[1]), title: match[2], start: Number(match[3]), end: Number(match[4]), units: [] };
      stages.push(stage);
    } else {
      const match = block.match(/^#### Day (\d+) — (.+)\n/);
      if (!match || !stage) throw new Error("Unit without stage");
      const body = block.slice(match[0].length).split(/^## /m)[0].trim();
      const field = (label) => {
        const value = body.split("\n").find((line) => line.startsWith(`- **${label}:** `));
        if (!value) throw new Error(`Unit ${match[1]}: missing ${label}`);
        return value.slice(`- **${label}:** `.length);
      };
      stage.units.push({ day: Number(match[1]), title: match[2], body, goal: field("Mục tiêu"), deliverable: field("Nộp/đạt") });
    }
  }
  const units = stages.flatMap((item) => item.units);
  if (stages.length !== 6 || units.length !== 30 || units.some((unit, i) => unit.day !== i + 1)) throw new Error("Expected six stages and thirty consecutive units");
  for (const item of stages) if (item.units.some((unit) => unit.day < item.start || unit.day > item.end)) throw new Error("Unit outside stage day range");
  return stages;
}

function shell(title, body, prefix = "", day = 0) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Lộ trình Elliott Wave 30 unit theo PDF Steve Sinclair, thực hành XAUUSDm, ví dụ và tiêu chí đánh giá.">
<title>${escape(title)} | Elliott Wave</title><link rel="stylesheet" href="${prefix}assets/style.css"><link rel="stylesheet" href="${prefix}assets/roadmap.css">${day ? `<link rel="stylesheet" href="${prefix}assets/source-chart.css"><script defer src="${prefix}assets/core.js"></script><script defer src="${prefix}assets/pdf-chart-data.js"></script><script defer src="${prefix}assets/app.js"></script><script defer src="${prefix}assets/chart-lab.js"></script><script defer src="${prefix}assets/pdf-practice.js"></script><script defer src="${prefix}assets/source-chart.js"></script>` : ""}</head>
<body class="pdf-roadmap" data-day="${day}" data-curriculum="${pdfDataset}"><a class="skip-link" href="#main">Đến nội dung chính</a>
<header class="site-header"><a class="brand" href="${prefix}index.html">EW <span>PDF ROADMAP</span></a><nav aria-label="Điều hướng chính"><a href="${prefix}index.html">Lộ trình mới</a><a href="${prefix}unit-structure.html">Cấu trúc unit</a><a href="${prefix}units/unit-04.html">Bài mẫu 04</a><a href="${prefix}legacy-index.html">Khóa HTML cũ</a></nav></header>
<main id="main">${body}</main><footer>Học tập lịch sử / Historical education · Không đặt lệnh · Không bảo đảm count hoặc lợi nhuận · <a href="${prefix}README.md">Hướng dẫn &amp; giới hạn</a></footer>
</body></html>
`;
}

export function roadmapPages() {
  const roadmap = read("Roadmap.md");
  const stages = parseRoadmap(roadmap);
  const number = (value) => String(value).padStart(2, "0");
  const home = `<section class="hero"><p class="eyebrow">PDF-BASED CURRICULUM · XAUUSDm · VIỆT–ENGLISH</p><h1>Lộ trình mới.<br>Học từng cấu trúc sóng.</h1><p class="lead">30 unit theo tài liệu Steve Sinclair: đọc cấu trúc, kiểm tra quy tắc, tự vẽ trên nến vàng thật và sửa count bằng bằng chứng.</p><div class="home-actions"><a class="button" href="units/unit-01.html">Học &amp; thực hành unit 01</a><a class="button" href="units/unit-04.html">Unit 04: impulse audit</a><a href="roadmap.html">Đọc toàn bộ roadmap</a></div>
<div class="hero-stats"><div><strong>30</strong><span>unit có chart thực hành</span></div><div><strong>180</strong><span>câu trắc nghiệm có giải thích</span></div><div><strong>120</strong><span>nhiệm vụ tự luận / vẽ</span></div></div></section>
<section class="notice" aria-labelledby="version-heading"><h2 id="version-heading">Hình PDF thật → câu hỏi ngay trên hình → tự vẽ XAUUSD</h2><p>30 unit dùng 19 trích hình được chọn từ PDF, có số trang/Image và lời giảng Việt–Anh mới. Mỗi unit: 2 câu chọn endpoint ngay trên hình (60 câu toàn khóa), 6 trắc nghiệm có giải thích, 4 nhiệm vụ tự luận/vẽ trên nến MT5. <a href="units/unit-01.html#source-lesson">Thử câu hỏi hình unit 01</a> · <a href="units/unit-22.html#source-lesson">Ví dụ price + RSI</a>.</p><p>Ảnh sách đã có nhãn là bài đọc hình, không phải đề thi blind hay nguồn MT5 của bạn. Workbook lưu riêng khóa cũ. Chấm điểm tọa độ và checker giá đều có giới hạn; các unit khác chưa có chương đọc dài như bài đọc mở rộng unit 04.</p></section>
<section class="start-grid"><div><p class="eyebrow">MỖI NGÀY MỘT UNIT</p><h2>Đọc → xem hình → vẽ → kiểm tra → sửa</h2><p>Dành 90–120 phút hoặc chia hai buổi. Học lại khi chưa đạt. Dùng Daily → H4 → H1 cùng mốc quan sát; luôn giữ bản vẽ trước khi mở thêm nến.</p><p><a href="unit-structure.html">Xem cấu trúc chuẩn và cách nộp bài</a></p></div><div><p class="eyebrow">TÀI LIỆU VÀ DỮ LIỆU</p><h2>Đọc nguồn có phản biện</h2><p><a href="data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=5">Mở PDF gốc — 105 trang</a>. Các liên kết trang dùng vị trí trong tệp PDF, kể cả bìa. Nếu trình đọc không nhảy trang, nhập số trang thủ công.</p><p><a href="data/Mt5Data/">Dữ liệu MT5 XAUUSDm</a> · <a href="roadmap.html#3-quy-ước-và-điểm-cần-đọc-có-phản-biện">Quy ước và lưu ý khi đọc sách</a></p></div></section>
<nav class="stage-jump" aria-label="Sáu giai đoạn">${stages.map((stage) => `<a href="#stage-${stage.number}"><span>GIAI ĐOẠN ${number(stage.number)}</span>${escape(stage.title)}<small>Unit ${number(stage.start)}–${number(stage.end)}</small></a>`).join("")}</nav>
${stages.map((stage) => `<section id="stage-${stage.number}" class="stage-section"><div class="stage-heading"><p class="eyebrow">GIAI ĐOẠN ${number(stage.number)} · UNIT ${number(stage.start)}–${number(stage.end)}</p><h2>${escape(stage.title)}</h2></div><div class="roadmap">${stage.units.map((unit) => `<article class="day-card" id="unit-${number(unit.day)}"><div class="card-meta"><span>UNIT ${number(unit.day)}</span><span class="unit-status ready">Trắc nghiệm + vẽ chart</span></div><h3>${escape(unit.title)}</h3><p>${escape(unit.goal)}</p><div class="card-output"><strong>Nộp / Đạt:</strong> ${escape(unit.deliverable)}</div><p><a class="button" href="units/${unitFile(unit.day)}">Học &amp; thực hành unit ${number(unit.day)} →</a></p><details class="unit-outline"><summary>Xem đề cương &amp; bài tập ${number(unit.day)}</summary>${markdownHtml(unit.body.replace(/^- \*\*Đáp án định hướng:\*\* (.+)$/m, ""), "Roadmap.md")}<details class="answer-key"><summary>Đáp án định hướng — tự làm trước</summary>${markdownHtml(unit.body.split("\n").find((line) => line.startsWith("- **Đáp án định hướng:** ")), "Roadmap.md")}</details></details></article>`).join("")}</div></section>`).join("")}
<section class="stage-milestone"><h2>Đạt kỹ năng, không chỉ hoàn thành ngày</h2><p>Mỗi bài: ít nhất 8/10 câu kiểm tra và 16/20 điểm chart rubric, không còn lỗi nghiêm trọng. Đây là tiêu chí học tập, không chứng nhận chuyên nghiệp hoặc lợi nhuận.</p><p><a href="roadmap.html#7-chấm-bài-và-vòng-sửa--feedback-protocol">Rubric và vòng sửa bài</a> · <a href="roadmap.html#8-sau-ngày-30">Sau ngày 30</a></p></section>`;
  const pages = { "index-30day.html": shell("Lộ trình PDF cũ — 30 unit XAUUSDm", home) };
  for (const [source, target] of published) {
    const prefix = target.startsWith("units/") ? "../" : "";
    const title = read(source).split("\n")[0].replace(/^# /, "");
    const archiveTarget = target === "roadmap.html" ? "roadmap-30day.html" : target === "unit-structure.html" ? "unit-structure-30day.html" : target;
    pages[archiveTarget] = shell(title, `<article class="published-document"><p class="eyebrow">PDF ROADMAP CŨ · 30 UNIT</p><p><a href="${prefix}index-30day.html">← Về bản 30 unit cũ</a></p>${markdownHtml(read(source), source)}</article>`, prefix);
  }
  const units = stages.flatMap((stage) => stage.units);
  const bundle = curriculumWindows(units);
  for (const unit of units) pages[`units/${unitFile(unit.day)}`] = unitPage(unit, bundle.windowsByDay[unit.day], quizzes[unit.day], { shell, markdownHtml });
  return pages;
}

export function curriculumWindows(units) {
  const bundle = loadWindows(root, labLessons(units));
  bundle.dataset = pdfDataset;
  for (const unit of units) {
    const window = bundle.windowsByDay[unit.day];
    window.id = `${pdfDataset}:unit-${unit.day}:${window.id}`;
    window.curriculum = pdfDataset;
    window.unitTitle = unit.title;
    window.unit = unit.day;
    window.questions = quizzes[unit.day];
    window.sourceLesson = sourceLesson(unit.day);
    if (unit.day === 22) {
      const text = read(window.source);
      const bars = parseMt5(text, window.source);
      const start = bars.findIndex((bar) => bar.date === window.bars[0].date);
      window.rsiHistory = bars.slice(Math.max(0, start - 200), start).map((bar) => bar.close);
    }
  }
  return bundle;
}

export function buildRoadmap() {
  const provenance = JSON.parse(read("units/source-figures/provenance.json"));
  const hash = (path) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
  if (hash(provenance.source) !== provenance.sourceSha256) throw new Error("Source PDF changed; rerun swift scripts/crop-pdf-charts.swift");
  if (provenance.source !== sourceFigures.source || JSON.stringify(provenance.referenceSize) !== JSON.stringify(sourceFigures.referenceSize) || provenance.figures.length !== sourceFigures.figures.length) throw new Error("Source manifest changed; rerun crop exporter");
  for (const figure of sourceFigures.figures) {
    const record = provenance.figures.find((item) => item.id === figure.id);
    if (!record || record.page !== figure.page || record.image !== figure.image || JSON.stringify(record.crop) !== JSON.stringify(figure.crop)) throw new Error(`Stale crop ${figure.id}; rerun crop exporter`);
  }
  for (const figure of provenance.figures) {
    if (hash(`units/source-figures/${figure.id}.png`) !== figure.sha256) throw new Error(`Source crop changed: ${figure.id}; rerun crop exporter`);
  }
  const pages = roadmapPages();
  if (!existsSync(resolve(root, "legacy-index.html"))) {
    if (!existsSync(resolve(root, "index.html"))) throw new Error("Cannot preserve the missing legacy index");
    copyFileSync(resolve(root, "index.html"), resolve(root, "legacy-index.html"));
  }
  buildUnitSample();
  const units = parseRoadmap(read("Roadmap.md")).flatMap((stage) => stage.units);
  for (const unit of units) writeFileSync(resolve(root, `units/figures/unit-${String(unit.day).padStart(2, "0")}-concept.svg`), conceptSvg(unit.day));
  writeFileSync(resolve(root, "assets/pdf-chart-data.js"), `// Generated from original MT5 exports for the PDF curriculum only.\nglobalThis.ElliottData = ${JSON.stringify(curriculumWindows(units))};\n`);
  for (const [name, html] of Object.entries(pages)) writeFileSync(resolve(root, name), html);
  console.log("Built PDF roadmap: 30 units, 19 PDF chart excerpts, 60 source-chart questions, 180 MCQs, 120 written tasks, independent XAUUSD labs.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildRoadmap();
