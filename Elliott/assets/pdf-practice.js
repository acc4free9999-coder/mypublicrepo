(function (root) {
  "use strict";
  function rsiValues(closes, period = 14) {
    if (!Number.isInteger(period) || period < 1 || !Array.isArray(closes) || !closes.every(Number.isFinite)) throw new Error("RSI needs finite closes and a positive integer period.");
    const result = Array(closes.length).fill(null);
    if (closes.length <= period) return result;
    let gain = 0, loss = 0;
    const value = () => gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    for (let i = 1; i <= period; i++) {
      const delta = closes[i] - closes[i - 1];
      gain += Math.max(0, delta) / period;
      loss += Math.max(0, -delta) / period;
    }
    result[period] = value();
    for (let i = period + 1; i < closes.length; i++) {
      const delta = closes[i] - closes[i - 1];
      gain = (gain * (period - 1) + Math.max(0, delta)) / period;
      loss = (loss * (period - 1) + Math.max(0, -delta)) / period;
      result[i] = value();
    }
    return result;
  }
  root.ElliottPdf = { rsiValues };
  if (typeof module !== "undefined" && module.exports) module.exports = { rsiValues };
  if (typeof document === "undefined") return;
  const app = root.ElliottApp;
  const fields = [...document.querySelectorAll(".mcq")];
  function clearGrade() {
    document.getElementById("quiz-score").textContent = "Đáp án đã đổi — chấm lại / Answers changed; grade again.";
    fields.forEach((field) => {
      field.querySelector(".quiz-feedback").textContent = "";
      field.querySelector(".quiz-explanation").hidden = true;
    });
  }
  function restore() {
    fields.forEach((field, index) => {
      const answer = app.state().answers?.[index + 1] || "";
      const radios = [...field.querySelectorAll('input[type="radio"]')];
      radios.forEach((radio) => { radio.checked = radio.parentElement.textContent.trim() === answer; });
      if (answer && !radios.some((radio) => radio.checked)) app.error(`Unit ${app.day}, question ${index + 1}: saved answer no longer matches options. Re-answer before saving.`);
    });
    clearGrade();
    document.getElementById("quiz-score").textContent = fields.some((field) => field.querySelector('input[type="radio"]:checked'))
      ? "Đã khôi phục lựa chọn — chấm để xem kết quả / Selections restored; grade to review."
      : "Chưa chấm / Not graded.";
  }
  fields.forEach((field) => {
    field.addEventListener("change", () => {
      const selected = field.querySelector('input[type="radio"]:checked');
      const saved = field.querySelector("[data-question]");
      saved.value = selected ? selected.parentElement.textContent.trim() : "";
      saved.dispatchEvent(new Event("input", { bubbles: true }));
      clearGrade();
    });
  });
  document.getElementById("grade-quiz").addEventListener("click", () => {
    let score = 0, answered = 0;
    fields.forEach((field) => {
      const selected = field.querySelector('input[type="radio"]:checked');
      const correct = field.dataset.correct;
      const passed = selected && selected.value === correct;
      if (selected) answered++;
      if (passed) score++;
      const correctOption = field.querySelector(`input[value="${correct}"]`).parentElement.textContent.trim();
      field.querySelector(".quiz-feedback").textContent = !selected ? `Chưa trả lời / Unanswered. Đáp án: ${correctOption}` : passed ? "Đúng / Correct." : `Cần sửa / Revise. Đáp án: ${correctOption}`;
      field.querySelector(".quiz-explanation").hidden = false;
    });
    document.getElementById("quiz-score").textContent = `${score}/${fields.length} đúng; đã trả lời ${answered}/${fields.length}. ${score >= 5 ? "Đạt checkpoint trắc nghiệm; bài vẽ vẫn cần rubric." : "Đọc giải thích và thử lại; chưa đạt checkpoint."}`;
    app.saveJournal();
  });
  function renderRsi() {
    const svg = document.getElementById("rsi-chart");
    if (!svg) return;
    const window = root.ElliottData.windowsByDay[app.day];
    const history = window.rsiHistory;
    if (!Array.isArray(history) || history.length < 14) {
      app.error("RSI warm-up data missing. Do not infer oscillator values from price geometry.");
      return;
    }
    const visible = window.bars.slice(0, app.state().cursor);
    const values = rsiValues([...history, ...visible.map((bar) => bar.close)]).slice(history.length);
    const ns = "http://www.w3.org/2000/svg";
    const node = (tag, attrs, text) => {
      const item = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attrs)) item.setAttribute(name, String(value));
      if (text) item.textContent = text;
      return item;
    };
    svg.replaceChildren(node("title", {}, "RSI(14) Wilder on original closes, no future values"));
    for (const level of [30, 50, 70]) {
      const y = 165 - level * 1.3;
      svg.append(node("line", { x1: 78, x2: 922, y1: y, y2: y, stroke: "#d8dfd5" }));
      svg.append(node("text", { x: 45, y: y + 4, "font-size": 12 }, String(level)));
    }
    const points = values.map((value, index) => `${78 + index / Math.max(1, window.bars.length - 1) * 844},${165 - value * 1.3}`).join(" ");
    svg.append(node("polyline", { points, stroke: "#6334a0", fill: "none", "stroke-width": 2 }));
    svg.append(node("text", { x: 78, y: 190, "font-size": 12 }, `${visible.at(-1).date} | RSI14 ${values.at(-1).toFixed(2)} | close / Wilder / warm-up ${history.length} bars`));
  }
  document.addEventListener("workbook-restored", () => { restore(); renderRsi(); });
  document.addEventListener("chart-rendered", renderRsi);
  restore();
  renderRsi();
})(globalThis);
