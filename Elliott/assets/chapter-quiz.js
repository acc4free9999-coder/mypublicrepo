(function (root) {
  "use strict";
  function grade(questions, answers) {
    if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error("Invalid answer count");
    return questions.map((question, index) => {
      const selected = answers[index];
      if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected >= question.options.length)) throw new Error("Invalid selected answer");
      return { selected, correct: selected === question.correct, unanswered: selected === null };
    });
  }
  function validateSaved(value, config) {
    if (!value || value.dataset !== config.dataset || value.chapter !== config.chapter || value.revision !== config.revision) throw new Error("Khác chương hoặc phiên bản câu hỏi. Tải bản sao trước khi chọn làm lại.");
    grade(config.questions,value.answers);
    return value.answers;
  }
  const api = { grade, validateSaved };
  root.ChapterQuiz = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  const notice = document.querySelector("#quiz-notice");
  const error = (message) => { notice.hidden = false; notice.textContent = message; };
  try {
    const config = JSON.parse(document.querySelector("#chapter-quiz-config").textContent);
    const fields = [...document.querySelectorAll(".chapter-question")];
    if (fields.length !== config.questions.length) throw new Error("Số câu hỏi HTML không khớp dữ liệu.");
    const key = `${config.dataset}:chapter-${config.chapter}`;
    const score = document.querySelector("#quiz-score");
    const status = document.querySelector("#save-status");
    let answers = config.questions.map(() => null);
    let blocked = false;
    let rawSaved = null;
    const clearGrade = () => {
      score.textContent = "Chưa chấm. Hãy chấm lại sau khi thay đổi lựa chọn.";
      for (const field of fields) {
        delete field.dataset.result;
        const feedback = field.querySelector(".question-feedback");
        feedback.hidden = true;
        feedback.textContent = "";
      }
    };
    const save = () => {
      if (blocked) { status.textContent = "Không ghi đè dữ liệu cũ đang lỗi. Tải JSON để giữ câu trả lời hiện tại."; return; }
      try {
        localStorage.setItem(key,JSON.stringify({ dataset:config.dataset, chapter:config.chapter, revision:config.revision, answers }));
        status.textContent = "Đã lưu lựa chọn của chương trên trình duyệt này.";
        notice.hidden = true;
      } catch (failure) {
        status.textContent = "Chưa lưu được; tải JSON trước khi rời trang.";
        error(`Không lưu được đáp án: ${failure.message}`);
      }
    };
    try {
      rawSaved = localStorage.getItem(key);
      if (rawSaved !== null) answers = validateSaved(JSON.parse(rawSaved),config).slice();
      answers.forEach((answer, index) => {
        if (answer !== null) fields[index].querySelector(`input[value="${answer}"]`).checked = true;
      });
    } catch (failure) {
      blocked = true;
      error(`Không khôi phục được đáp án: ${failure.message}`);
      status.textContent = "Dữ liệu cũ được giữ nguyên, chưa bị ghi đè. Có thể tải bản sao JSON hoặc chủ động làm lại chương.";
    }
    fields.forEach((field, index) => field.addEventListener("change", (event) => {
      if (!event.target.matches('input[type="radio"]')) return;
      const selected = Number(event.target.value);
      if (!Number.isInteger(selected) || !config.questions[index].options[selected]) { error("Lựa chọn không hợp lệ."); return; }
      answers[index] = selected;
      clearGrade();
      save();
    }));
    document.querySelector("#grade-quiz").addEventListener("click", () => {
      const results = grade(config.questions,answers);
      results.forEach((result,index) => {
        const question = config.questions[index];
        const feedback = fields[index].querySelector(".question-feedback");
        fields[index].dataset.result = result.correct ? "correct" : "incorrect";
        const page = question.pages[0] === question.pages[1] ? question.pages[0] : question.pages.join("–");
        feedback.textContent = `${result.unanswered ? "Chưa trả lời." : result.correct ? "Đúng." : "Chưa đúng."} Đáp án: ${String.fromCharCode(65 + question.correct)}. ${question.options[question.correct]}. ${question.explanation} Đối chiếu PDF trang ${page}.`;
        feedback.hidden = false;
      });
      score.textContent = `Kết quả: ${results.filter((result) => result.correct).length}/${results.length} đúng · ${results.filter((result) => result.unanswered).length} chưa trả lời.`;
    });
    document.querySelector("#reset-quiz").addEventListener("click", () => {
      if (!root.confirm("Xóa lựa chọn đã lưu của riêng chương này để làm lại?")) return;
      try {
        localStorage.removeItem(key);
      } catch (failure) {
        error(`Không xóa được dữ liệu: ${failure.message}. Câu trả lời đang hiển thị chưa bị thay đổi.`);
        return;
      }
      answers = config.questions.map(() => null);
      rawSaved = null;
      blocked = false;
      for (const field of fields) for (const input of field.querySelectorAll("input")) input.checked = false;
      clearGrade();
      notice.hidden = true;
      status.textContent = "Đã xóa lựa chọn của chương này. Các chương và workbook khác giữ nguyên.";
    });
    document.querySelector("#export-answers").addEventListener("click", () => {
      const packet = {
        format:"elliott-pdf-chapter-answers-v1", dataset:config.dataset, chapter:config.chapter, revision:config.revision,
        ...(blocked && rawSaved !== null ? { unreadableSavedCopy:rawSaved } : {}),
        questions:config.questions.map((question,index) => ({
          ...question, selected:answers[index], selectedAnswer:answers[index] === null ? null : question.options[answers[index]]
        }))
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:"application/json"}));
      const link = document.createElement("a");
      link.href = url;
      link.download = `elliott-chapter-${config.chapter}-answers.json`;
      document.body.append(link);
      link.click();
      link.remove();
      root.setTimeout(() => URL.revokeObjectURL(url),1000);
    });
    document.querySelector("#print-chapter").addEventListener("click", () => root.print());
    api.ready = true;
  } catch (failure) {
    error(`Không mở được bài kiểm tra: ${failure.message}`);
  }
})(globalThis);
