const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const paragraph = (vi, en) => `<div class="bilingual-pair"><div lang="vi"><span class="language-tag">VI</span><p>${escape(vi)}</p></div><div lang="en"><span class="language-tag">EN</span><p>${escape(en)}</p></div></div>`;
export const figureName = (day, index) => `day-${String(day).padStart(2, "0")}-figure-${index + 1}.svg`;

export const glossaryHtml = `<section><h2>Từ vựng để đọc biểu đồ / Chart-reading glossary</h2><div class="table-wrap"><table><thead><tr><th>English</th><th>Tiếng Việt</th><th>Cách dùng / How to use</th></tr></thead><tbody>
<tr><td>Wave count</td><td lang="vi">Giả thuyết đếm sóng</td><td lang="vi">Một cách diễn giải các nhịp giá, không phải sự thật duy nhất. / An interpretation of swings, not a uniquely known truth.</td></tr>
<tr><td>Degree</td><td lang="vi">Cấp độ sóng</td><td lang="vi">Quan hệ sóng mẹ và sóng con; không đồng nhất máy móc với khung giờ. / Relative nesting, not a fixed timeframe.</td></tr>
<tr><td>Subdivision</td><td lang="vi">Cấu trúc bên trong</td><td lang="vi">Các sóng nhỏ tạo thành một sóng lớn; phải kiểm tra, không suy ra từ hình dáng. / Internal waves must be inspected, not assumed from shape.</td></tr>
<tr><td>Invalidation</td><td lang="vi">Điều kiện bác bỏ</td><td lang="vi">Mức giá hoặc sự kiện cấu trúc làm sai giả thuyết hiện tại. / A price or structural event that disproves the current hypothesis.</td></tr>
<tr><td>Rule / guideline</td><td lang="vi">Quy tắc / đặc điểm thường gặp</td><td lang="vi">Quy tắc phải giữ cho cấu trúc đang xét; guideline có thể không xuất hiện. / Rules constrain a pattern; guidelines are tendencies, not obligations.</td></tr>
<tr><td>Confirmed pivot</td><td lang="vi">Điểm xoay được xác nhận</td><td lang="vi">Chỉ biết sau khi đủ nến bên phải; ngày xảy ra khác ngày có thể xác nhận. / The occurrence time differs from the later time it becomes knowable.</td></tr>
<tr><td>Impulse / corrective</td><td lang="vi">Sóng đẩy / cấu trúc điều chỉnh</td><td lang="vi">Không phân biệt chỉ bằng độ dốc hay nến mạnh; cần quy tắc, cấp độ và nội bộ. / Slope alone is insufficient; structure and degree matter.</td></tr>
<tr><td>Alternate count</td><td lang="vi">Kịch bản đếm sóng thay thế</td><td lang="vi">Giả thuyết cạnh tranh được ghi trước kết quả, có điều kiện bác bỏ riêng. / A competing hypothesis recorded beforehand with its own invalidation.</td></tr>
<tr><td>Retracement / extension</td><td lang="vi">Hồi lại / chiếu mở rộng</td><td lang="vi">Hai cách đo khác nhau; ghi rõ neo trước khi tính. / Distinct measurements; specify all anchors before calculation.</td></tr>
<tr><td>R multiple</td><td lang="vi">Kết quả theo rủi ro ban đầu</td><td lang="vi">Lãi/lỗ ròng chia rủi ro tiền mặt ban đầu; không đổi mẫu số sau khi thua. / Net P/L divided by fixed initial planned cash risk.</td></tr>
</tbody></table></div><p lang="vi">Học từng nguyên lý ở bài tương ứng, đọc hình và tự trả lời rồi mới mở lời giải. Chỉ dùng biểu đồ nến thật để kiểm tra dữ liệu; sơ đồ giảng dạy không thay thế việc kiểm tra các râu nến và sóng con.</p></section>`;

export function diagramSvg(day, figure, index) {
  const width = 960, height = 480;
  const low = Math.min(...figure.points), high = Math.max(...figure.points);
  const span = high - low;
  const y = (price) => 135 + (high - price) / span * 200;
  const x = (i) => 95 + i / (figure.points.length - 1) * 770;
  const coords = figure.points.map((price, i) => `${x(i)},${y(price)}`).join(" ");
  const labelLines = (value) => {
    const words = String(value).split(/\s+/);
    const lines = [""];
    for (const word of words) {
      if (lines.at(-1) && lines.at(-1).length + word.length + 1 > 16) lines.push(word);
      else lines[lines.length - 1] += (lines.at(-1) ? " " : "") + word;
    }
    return lines;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Day ${day}, figure ${index + 1}: ${escape(figure.titleEn)}</title>
<desc id="desc">${escape(figure.en)} Original synthetic teaching diagram, not MT5 market data.</desc>
<rect width="${width}" height="${height}" rx="12" fill="#fffef9"/>
<text x="30" y="32" font-family="sans-serif" font-size="14" fill="#176455">FIGURE ${index + 1} / HÌNH ${index + 1} • DAY ${day} • SYNTHETIC TEACHING EXAMPLE</text>
<text x="30" y="60" font-family="sans-serif" font-size="19" fill="#162f31">${escape(figure.titleEn)}</text>
${[0, 1, 2, 3].map((i) => {
    const value = high - i / 3 * span;
    return `<line x1="75" x2="905" y1="${y(value)}" y2="${y(value)}" stroke="#d8dfd5"/><text x="65" y="${y(value) + 4}" text-anchor="end" font-family="sans-serif" font-size="12" fill="#516466">${Number(value.toFixed(3))}</text>`;
  }).join("")}
<polyline points="${coords}" fill="none" stroke="${index % 2 ? "#b54f24" : "#176455"}" stroke-width="3.5"/>
${figure.points.map((price, i) => {
    const lines = labelLines(figure.labels[i]);
    const startY = y(price) + (i % 2 ? -15 - (lines.length - 1) * 14 : 23);
    return `<circle cx="${x(i)}" cy="${y(price)}" r="5" fill="#6334a0"/><text x="${x(i)}" y="${startY}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#542b88">${lines.map((line, row) => `<tspan x="${x(i)}" dy="${row ? 14 : 0}">${escape(line)}</tspan>`).join("")}</text><text x="${x(i)}" y="${i % 2 ? startY - 15 : startY + lines.length * 14}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#516466">${Number(price.toFixed(3))}</text>`;
  }).join("")}
<text x="30" y="455" font-family="sans-serif" font-size="12" fill="#516466">Synthetic coordinates, not market candles. Read endpoints and captions; verify subdivisions separately.</text>
</svg>\n`;
}

export function teachingHtml(unit) {
  return `<section id="deep-principles" class="deep-teaching"><p class="eyebrow">NGUYÊN LÝ CHI TIẾT / PRINCIPLES IN DEPTH</p><h2 lang="vi">${escape(unit.titleVi)}</h2><p class="caption" lang="vi">Đọc phần Việt và đối chiếu thuật ngữ tiếng Anh. Giải thích lại bằng lời của bạn trước khi xem hình. Các quy tắc mô tả cấu trúc, không bảo đảm dự báo hoặc lợi nhuận.</p>
${unit.principles.map((principle, index) => `<article class="principle-card"><p class="eyebrow">PRINCIPLE ${index + 1} / NGUYÊN LÝ ${index + 1}</p><h3><span lang="vi">${escape(principle.titleVi)}</span><small lang="en">${escape(principle.titleEn)}</small></h3>${paragraph(principle.vi, principle.en)}</article>`).join("")}</section>
<section id="illustrated-examples"><h2>Hình minh họa &amp; cách đọc / Illustrated examples</h2><p lang="vi">Các hình dưới đây là ví dụ giảng dạy được tạo riêng, không phải dữ liệu thị trường. Biểu đồ nến XAUUSDm thật nằm ở phòng thực hành phía dưới. Đọc chú thích để hiểu hình đúng ở đâu, sai ở đâu và phần nào còn chưa xác minh.</p>
${unit.figures.map((figure, index) => `<figure class="teaching-figure"><h3><span lang="vi">${escape(figure.titleVi)}</span><small lang="en">${escape(figure.titleEn)}</small></h3><a href="../assets/figures/${figureName(unit.day, index)}" target="_blank" rel="noopener"><img src="../assets/figures/${figureName(unit.day, index)}" alt="${escape(`Figure ${index + 1}: ${figure.titleEn}. ${figure.en}`)}" width="960" height="480" loading="lazy"></a><figcaption>${paragraph(figure.vi, figure.en)}<a class="no-print" href="../assets/figures/${figureName(unit.day, index)}" download>Download SVG / Tải hình</a></figcaption></figure>`).join("")}</section>
<section id="worked-calculation" class="worked-calculation"><p class="eyebrow">GIẢI TỪNG BƯỚC / STEP-BY-STEP</p><h2>Ví dụ có lời giải / Worked reasoning</h2>${paragraph(unit.walkthrough.vi, unit.walkthrough.en)}<h3>Lỗi dễ mắc / Common mistakes</h3>${paragraph(unit.mistakes.vi, unit.mistakes.en)}</section>`;
}

export function questionsHtml(unit) {
  return `<section id="question-bank"><p class="eyebrow">TỰ LÀM TRƯỚC / ATTEMPT BEFORE REVEALING ANSWERS</p><h2>Câu hỏi &amp; bài tập / Questions and exercises</h2><p lang="vi">Viết câu trả lời trước khi mở đáp án. Bài tập biểu đồ được tự đối chiếu với tiêu chí, không chấm tự động theo một “đáp án duy nhất”. Bấm Lưu để giữ câu trả lời cùng nhật ký và bản sao JSON.</p><p lang="en">Save your responses with the journal. Model answers explain the reasoning; they are not automatic certification of a real-chart count.</p>
${unit.questions.map((question, i) => `<article class="question-card"><h3>Q${i + 1} / Câu ${i + 1}</h3>${paragraph(question.vi, question.en)}<label for="response-${i + 1}">Câu trả lời của bạn / Your response</label><textarea id="response-${i + 1}" class="question-response" data-question="${i + 1}" maxlength="12000" rows="4"></textarea><details class="model-answer"><summary>Lời giải &amp; lập luận / Answer and reasoning</summary>${paragraph(question.answerVi, question.answerEn)}</details></article>`).join("")}<button id="save-responses" class="no-print">Lưu câu trả lời / Save responses</button><p id="responses-status" role="status"></p></section>`;
}
