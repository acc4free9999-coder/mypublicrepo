import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { chapters, introduction, conclusion, pdfSource, validateChapters } from "../teaching/pdf-chapters.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const provenance = JSON.parse(readFileSync(resolve(root, "units/source-figures/provenance.json"), "utf8"));
const figures = JSON.parse(readFileSync(resolve(root, "teaching/source-figures.json"), "utf8")).figures;
export const chapterFile = (id) => `chapter-${String(id).padStart(2, "0")}.html`;
const range = ([start, end]) => start === end ? String(start) : `${start}–${end}`;
const pdfLink = (pages, prefix = "") => `<a href="${prefix}${pdfSource}#page=${pages[0]}">PDF tr. ${range(pages)}</a>`;
export const quizRevision = (chapter) => createHash("sha256").update(JSON.stringify(chapter.questions)).digest("hex").slice(0, 16);

function shell(title, body, prefix = "", interactive = false) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | Elliott Waves Made Simple</title>
<meta name="description" content="Học theo đúng sáu chương PDF Steve Sinclair; trắc nghiệm đọc hiểu có giải thích và trang đối chiếu.">
<link rel="stylesheet" href="${prefix}assets/chapters.css">${interactive ? `<script defer src="${prefix}assets/chapter-quiz.js"></script>` : ""}</head>
<body><a class="skip-link" href="#main">Đến nội dung</a><header><a class="brand" href="${prefix}index.html">ELLIOTT · THEO CHƯƠNG PDF</a><nav aria-label="Điều hướng"><a href="${prefix}index.html">Mục lục</a><a href="${prefix}roadmap.html">Roadmap</a><a href="${prefix}unit-structure.html">Cách học</a></nav></header>
<main id="main">${body}</main><footer>Steve Sinclair · Tài liệu học: Elliott Waves Made Simple · Câu hỏi và tóm lược được soạn mới để đọc hiểu PDF. Không phải lời khuyên giao dịch.<br><a href="${prefix}index-30day.html">Bản 30 unit cũ — lưu riêng</a></footer></body></html>\n`;
}

function figureHtml(id) {
  const figure = figures.find((item) => item.id === id);
  const record = provenance.figures.find((item) => item.id === id);
  if (!figure || !record) throw new Error(`Unknown PDF figure ${id}`);
  return `<figure id="figure-${id}"><img src="../units/source-figures/${id}.png" width="${record.width}" height="${record.height}" loading="lazy" alt="${escape(figure.title)}"><figcaption>Steve Sinclair · Image ${figure.image} · ${pdfLink([figure.page,figure.page], "../")} · Trích hình để đối chiếu phần đang học; nhãn gốc của tác giả.</figcaption></figure>`;
}

function chapterPage(chapter) {
  const figureIds = new Set(chapter.sections.flatMap((item) => item.figures));
  for (const question of chapter.questions) if (question.figure && !figureIds.has(question.figure)) throw new Error(`Question references figure not taught in chapter ${chapter.id}`);
  const config = {
    dataset: "elliott-pdf-chapters-v1", chapter: chapter.id, revision: quizRevision(chapter),
    questions: chapter.questions.map((question, index) => ({
      id: `chapter-${chapter.id}-q${index + 1}`, options: question.options,
      prompt: question.prompt, correct: question.correct, explanation: question.explanation, pages: question.pages
    }))
  };
  return shell(`Chương ${chapter.roman} — ${chapter.vi}`, `<article>
<p class="eyebrow">CHAPTER ${chapter.roman} · ${pdfLink(chapter.pages, "../")}</p><h1>${escape(chapter.title)}</h1><p class="subtitle">${escape(chapter.vi)}</p>
<p>Đọc trang ${range(chapter.pages)} trong PDF, theo các mục dưới đây, rồi làm ${chapter.questions.length} câu hỏi của riêng chương này. Nội dung dưới đây là tóm lược đọc hiểu, không thay thế toàn chương gốc.</p>
<nav class="chapter-toc" aria-label="Mục trong chương">${chapter.sections.map((item, index) => `<a href="#section-${index + 1}">${escape(item.title)}</a>`).join("")}<a href="#quiz">Trắc nghiệm (${chapter.questions.length} câu)</a></nav>
<div id="quiz-notice" role="alert" hidden></div>
${chapter.sections.map((item, index) => `<section id="section-${index + 1}"><h2>${escape(item.title)}</h2><p class="source-ref">${pdfLink(item.pages, "../")}</p><p>${escape(item.summary)}</p>${item.figures.map(figureHtml).join("")}</section>`).join("")}
${chapter.notes.length ? `<aside class="source-notes"><h2>Lưu ý khi đối chiếu nguồn</h2><ul>${chapter.notes.map((item) => `<li>${escape(item.text)} ${pdfLink(item.pages,"../")}</li>`).join("")}</ul></aside>` : ""}
<section id="quiz"><h2>Trắc nghiệm chương ${chapter.roman}</h2><p>Chỉ hỏi nội dung thuộc trang ${range(chapter.pages)}. Chọn một đáp án mỗi câu rồi chấm; câu chưa trả lời tính là chưa đúng. Lời giải có trang kiểm tra lại.</p>
${chapter.questions.map((question, index) => `<fieldset class="chapter-question" data-question="${index + 1}"><legend>${index + 1}. ${escape(question.prompt)}</legend><p class="source-ref">${pdfLink(question.pages,"../")}${question.figure ? ` · <a href="#figure-${question.figure}">Xem hình liên quan trong bài</a>` : ""}</p>${question.options.map((option, choice) => `<label><input type="radio" name="question-${index + 1}" value="${choice}"> <span>${String.fromCharCode(65 + choice)}. ${escape(option)}</span></label>`).join("")}<p class="question-feedback" role="status" hidden></p></fieldset>`).join("")}
<script id="chapter-quiz-config" type="application/json">${JSON.stringify(config).replace(/</g,"\\u003c")}</script>
<div class="quiz-actions"><button id="grade-quiz" type="button">Chấm bài và xem giải thích</button><button id="reset-quiz" class="secondary" type="button">Làm lại chương này</button><button id="export-answers" class="secondary" type="button">Tải câu trả lời JSON</button><button id="print-chapter" class="secondary" type="button">In chương</button></div><p id="quiz-score" role="status">Chưa chấm.</p><p id="save-status" role="status">Lựa chọn được lưu riêng cho khóa theo chương trên trình duyệt này.</p>
<noscript>Cần bật JavaScript để chấm và lưu câu trả lời. Bạn vẫn có thể đọc chương và mở PDF gốc.</noscript>
<p>Điểm là kết quả đọc hiểu tài liệu, không phải chứng nhận đếm sóng hay hiệu quả giao dịch.</p></section>
<nav class="chapter-navigation" aria-label="Chuyển chương">${chapter.id > 1 ? `<a href="${chapterFile(chapter.id - 1)}">← Chương ${chapters[chapter.id - 2].roman}</a>` : `<a href="../index.html#introduction">← Introduction</a>`}${chapter.id < 6 ? `<a href="${chapterFile(chapter.id + 1)}">Chương ${chapters[chapter.id].roman} →</a>` : `<a href="../index.html#conclusion">Conclusion →</a>`}</nav></article>`, "../", true);
}

export function roadmapMarkdown() {
  return `# Roadmap — học theo từng chương PDF

Nguồn duy nhất: Steve Sinclair, [Elliott Waves Made Simple](./${pdfSource}), 105 trang PDF. Thứ tự và tên chương theo mục lục trang 5; số trang tính từ bìa.

**Thay toàn bộ lộ trình 30 ngày:** không chia unit/ngày, không thêm MT5/XAUUSD, sizing worksheet, replay, bài vẽ hay chủ đề ngoài sách. Mỗi chương có trang HTML riêng và trắc nghiệm đọc hiểu của chính chương đó.

Mở [index HTML](./index.html) hoặc [roadmap HTML](./roadmap.html). [Cách học một chương](./Unit-structure.md). Bản cũ được giữ tại [index 30 unit cũ](./index-30day.html), không thuộc khóa mới.

## Introduction — trang 7–8

${introduction.summary} [Đọc PDF](./${pdfSource}#page=7).

${chapters.map((chapter) => `## Chương ${chapter.roman} — ${chapter.title}

**${chapter.vi} · PDF trang ${range(chapter.pages)} · ${chapter.questions.length} câu trắc nghiệm.**

[Mở chương ${chapter.roman} và làm bài](./chapters/${chapterFile(chapter.id)}) · [Đọc PDF từ trang ${chapter.pages[0]}](./${pdfSource}#page=${chapter.pages[0]}).

${chapter.sections.map((item) => `- **${item.title}** — trang ${range(item.pages)}. ${item.summary}`).join("\n")}
`).join("\n")}
## Conclusion — trang 105

${conclusion.summary} [Đọc PDF](./${pdfSource}#page=105).

## Quy tắc câu hỏi và giới hạn

- ${chapters.reduce((sum, chapter) => sum + chapter.questions.length, 0)} câu mới, chỉ dựa trên PDF; không phải câu hỏi nguyên bản của tác giả. Mỗi câu có đúng một đáp án, giải thích và trang đối chiếu trong chính chương.
- Hỏi cấu trúc, nhãn, vị trí, công cụ, entry/stop/target và ví dụ mà sách thực sự trình bày; không chen bài toán broker hoặc dữ liệu ngoài.
- Những chỗ nguồn không nhất quán được ghi chú tại chương. Không dùng chúng làm câu hỏi mơ hồ; nếu hỏi riêng chi tiết một case thì ghi rõ trang/case.
- Trích hình giữ attribution tác giả, số Image và trang. Tóm lược và câu hỏi được soạn mới; muốn đọc đầy đủ hãy mở PDF, không coi HTML là bản sao toàn sách.
- Điểm chỉ kiểm tra đọc hiểu, không xác nhận chiến lược có lợi nhuận. Tỷ lệ rủi ro và các policy trong sách không phải khuyến nghị cá nhân.
- Lựa chọn lưu riêng theo chương và phiên bản câu hỏi; không đọc/ghi workbook 30 ngày. Có thể tải JSON câu trả lời để giữ bản sao.
`;
}

export const unitStructureMarkdown = `# Cách học một chương PDF

Khóa mới có sáu chương theo đúng mục lục Steve Sinclair, không còn cấu trúc một ngày/unit.

1. Mở [mục lục](./index.html), chọn chương theo thứ tự I → VI.
2. Đọc đúng khoảng trang PDF ở đầu chương; các mục con HTML đi cùng thứ tự nguồn.
3. Đọc tóm lược ngắn và đối chiếu hình gốc được trích, hoặc mở toàn trang PDF. Không có chart MT5 độc lập.
4. Làm tất cả câu trắc nghiệm của chương. Mỗi câu ghi trang PDF liên quan; câu có hình dẫn về hình trong bài.
5. Bấm “Chấm bài và xem giải thích”. Xem đáp án, lý do và số trang; quay lại nguồn với câu sai/chưa trả lời.
6. Đổi lựa chọn sẽ xóa điểm chấm cũ để tránh hiển thị kết quả không còn đúng. Chấm lại sau khi sửa.
7. “Làm lại chương này” yêu cầu xác nhận và chỉ xóa đáp án chương đang mở. Có thể tải JSON trước khi xóa.

## Phạm vi

- Trắc nghiệm là câu hỏi mới dựa trên nội dung sách, không sao chép bộ câu hỏi của tác giả.
- Các khác biệt/mâu thuẫn của nguồn được ghi chú ngắn; không kéo dài sang giáo trình khác.
- Không có quota vẽ, replay, sizing, rubric giao dịch hay chứng nhận beginner-to-pro.
- Điểm phản ánh đọc hiểu. Mức entry/stop/target trong sách là nội dung để học, không là lời khuyên đặt lệnh.

## Lưu đáp án

Lựa chọn được tự lưu theo chương tại khóa trình duyệt \`elliott-pdf-chapters-v1:chapter-N\`, khác các workbook cũ. Dữ liệu sai phiên bản hoặc không đọc được sẽ báo rõ và không bị ghi đè tự động. Dùng “Tải câu trả lời JSON” để lưu bản sao; JSON là hồ sơ câu trả lời, không phải chức năng import.

Browser có thể chặn localStorage khi mở file trực tiếp; khi có lỗi lưu hãy tải JSON trước khi rời bài. Giữ cùng đường dẫn và trình duyệt nếu muốn khôi phục lựa chọn. HTML offline không phải bài thi chống xem đáp án.

[Roadmap](./Roadmap.md) · [Mục lục HTML](./index.html) · [Bản 30 unit cũ](./index-30day.html)
`;

function documentHtml(markdown) {
  const inline = (text) => escape(text).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const published = { "./Roadmap.md":"roadmap.html", "./Unit-structure.md":"unit-structure.html" };
    return `<a href="${published[href] || href}">${label}</a>`;
  });
  return markdown.split("\n").filter((line) => line.trim()).map((line) => {
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
    if (/^- /.test(line)) return `<p class="list-line">• ${inline(line.slice(2))}</p>`;
    return `<p>${inline(line)}</p>`;
  }).join("\n");
}

export function roadmapPages() {
  validateChapters();
  const count = chapters.reduce((sum, chapter) => sum + chapter.questions.length, 0);
  const home = `<p class="eyebrow">STEVE SINCLAIR · ELLIOTT WAVES MADE SIMPLE</p><h1>Học đúng từng chương PDF.</h1><p class="subtitle">6 chương · ${count} câu trắc nghiệm · Có giải thích và trang đối chiếu</p>
<p>Không còn lộ trình 30 ngày hay bài thực hành XAUUSD. Chỉ học nội dung trong sách, theo đúng thứ tự mục lục trang 5.</p><p>${pdfLink([5,5])} · <a href="chapters/chapter-01.html">Bắt đầu chương I →</a></p>
<section id="introduction"><h2>Introduction</h2><p>${escape(introduction.summary)}</p><p>${pdfLink(introduction.pages)}</p></section>
<div class="chapter-grid">${chapters.map((chapter) => `<article class="chapter-card"><p class="eyebrow">CHƯƠNG ${chapter.roman} · PDF ${range(chapter.pages)}</p><h2><a href="chapters/${chapterFile(chapter.id)}">${escape(chapter.title)}</a></h2><p>${escape(chapter.vi)}</p><ul>${chapter.sections.map((item) => `<li>${escape(item.title)}</li>`).join("")}</ul><p><strong>${chapter.questions.length} câu trắc nghiệm theo chương</strong></p><a class="button" href="chapters/${chapterFile(chapter.id)}">Đọc và làm bài →</a></article>`).join("")}</div>
<section id="conclusion"><h2>Conclusion</h2><p>${escape(conclusion.summary)}</p><p>${pdfLink(conclusion.pages)}</p></section>
<aside><h2>Cách dùng</h2><p>Đọc PDF → xem tóm lược và hình → trả lời → chấm và đọc giải thích → đối chiếu trang sai. Đáp án tự lưu riêng theo chương; không chuyển workbook cũ sang khóa mới.</p><p>Đây là bài đọc hiểu tài liệu, không phải lời khuyên giao dịch hay chứng nhận năng lực. <a href="unit-structure.html">Hướng dẫn học và lưu đáp án</a>.</p></aside>`;
  return {
    "index.html": shell("Mục lục sáu chương PDF",home),
    "roadmap.html": shell("Roadmap theo chương PDF", `<article>${documentHtml(roadmapMarkdown())}</article>`),
    "unit-structure.html": shell("Cách học một chương PDF", `<article>${documentHtml(unitStructureMarkdown)}</article>`),
    ...Object.fromEntries(chapters.map((chapter) => [`chapters/${chapterFile(chapter.id)}`, chapterPage(chapter)]))
  };
}

export function buildRoadmap() {
  const hash = (path) => createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex");
  if (hash(pdfSource) !== provenance.sourceSha256) throw new Error("Source PDF changed; verify chapters and regenerate excerpt provenance.");
  const used = new Set(chapters.flatMap((chapter) => chapter.sections.flatMap((item) => item.figures)));
  for (const id of used) {
    const record = provenance.figures.find((item) => item.id === id);
    const manifest = figures.find((item) => item.id === id);
    if (!record || !manifest || record.page !== manifest.page || JSON.stringify(record.crop) !== JSON.stringify(manifest.crop) || hash(`units/source-figures/${id}.png`) !== record.sha256) throw new Error(`Stale PDF excerpt ${id}; rerun crop exporter.`);
  }
  const pages = roadmapPages();
  mkdirSync(resolve(root,"chapters"), { recursive: true });
  writeFileSync(resolve(root,"Roadmap.md"),roadmapMarkdown());
  writeFileSync(resolve(root,"Unit-structure.md"),unitStructureMarkdown);
  for (const [path, html] of Object.entries(pages)) writeFileSync(resolve(root,path),html);
  console.log(`Built 6 PDF chapters and ${chapters.reduce((sum, chapter) => sum + chapter.questions.length,0)} source-based MCQs; no MT5 dependency.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildRoadmap();
