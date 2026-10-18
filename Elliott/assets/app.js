(function () {
  "use strict";
  const core = globalThis.ElliottCore, windows = globalThis.ElliottData.windowsByDay;
  const dataset = document.body.dataset.curriculum || "xauusd-roadmap-v3";
  const key = dataset === "xauusd-pdf-v1" ? "elliott-field-school-pdf-v1" : "elliott-field-school-roadmap-v3";
  const day = Number(document.body.dataset.day);
  const notice = document.getElementById("notice"), status = document.getElementById("status");
  const journal = document.getElementById("journal"), journalStatus = document.getElementById("journal-status");
  let workbook = core.emptyWorkbook(dataset), blocked = false, dirty = false, unbacked = false;
  const error = (message) => { notice.textContent = message; notice.hidden = false; };
  try {
    const saved = localStorage.getItem(key);
    if (saved) workbook = core.validateWorkbook(JSON.parse(saved), windows, dataset);
  } catch (cause) {
    blocked = true;
    error(`Gold workbook could not be read: ${cause.message} Existing records will not be overwritten. Work in memory and export, or import a matching valid backup.`);
  }
  function state() {
    if (!day) throw new Error("No lesson selected.");
    if (!workbook.days[day]) workbook.days[day] = core.initialDay(windows[day]);
    return workbook.days[day];
  }
  function persist() {
    try {
      if (blocked) throw new Error("Unreadable existing records are protected from overwrite.");
      localStorage.setItem(key, JSON.stringify(workbook));
      unbacked = false;
      return true;
    } catch (cause) {
      unbacked = true;
      error(`Browser save failed: ${cause.message} Your current work is in memory only. Export before leaving.`);
      return false;
    }
  }
  function saveJournal() {
    if (!journal) return;
    state().journal = journal.value;
    state().answers = Object.fromEntries([...document.querySelectorAll("[data-question]")].map((input) => [input.dataset.question, input.value]));
    dirty = false;
    const saved = persist();
    journalStatus.textContent = saved ? "Đã lưu nhật ký và câu trả lời / Journal and answers saved." : "In memory only; export a backup.";
    const responseStatus = document.getElementById("responses-status");
    if (responseStatus) responseStatus.textContent = journalStatus.textContent;
  }
  function progress() {
    const completed = Object.values(workbook.days).filter((item) => item.completed).length;
    document.querySelectorAll("[data-progress-day]").forEach((node) => node.classList.toggle("is-complete", Boolean(workbook.days[node.dataset.progressDay]?.completed)));
    const summary = document.getElementById("progress-summary"), bar = document.getElementById("course-progress");
    if (summary) summary.textContent = `${completed} of 30 days complete`;
    if (bar) { bar.value = completed; bar.textContent = `${completed}/30`; }
  }
  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function hydrate() {
    if (journal) {
      journal.value = state().journal || journal.defaultValue;
      document.getElementById("complete-day").checked = state().completed;
      document.querySelectorAll("[data-question]").forEach((input) => { input.value = state().answers?.[input.dataset.question] || ""; });
      dirty = false;
    }
    progress();
    document.dispatchEvent(new Event("workbook-restored"));
  }
  document.getElementById("export-workbook").addEventListener("click", () => {
    saveJournal();
    download(JSON.stringify(core.validateWorkbook(workbook, windows, dataset), null, 2), `elliott-${dataset}-workbook-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    status.textContent = "Roadmap workbook download requested. Prior course records remain separate.";
  });
  const input = document.getElementById("import-file");
  document.getElementById("import-workbook").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Backup exceeds 5 MB.");
      const imported = core.validateWorkbook(JSON.parse(await file.text()), windows, dataset);
      if (!confirm("Replace all redesigned Roadmap workbook records and unsaved notes with this backup? Export first if needed. Previous-course records will not be changed.")) return;
      workbook = imported; blocked = false; notice.hidden = true;
      const saved = persist();
      hydrate();
      status.textContent = saved ? "Gold workbook imported and saved." : "Imported in memory only; export before leaving.";
    } catch (cause) { error(`Import rejected: ${cause.message}`); }
    finally { input.value = ""; }
  });
  document.getElementById("export-previous")?.addEventListener("click", () => {
    try {
      const saved = localStorage.getItem("elliott-field-school-xauusd-v2");
      if (!saved) { status.textContent = "No previous gold workbook exists on this browser origin. Nothing was changed."; return; }
      download(saved, `elliott-previous-gold-workbook-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      status.textContent = "Previous-course backup download requested, unchanged. It is not importable into redesigned day numbers.";
    } catch (cause) { error(`Could not export previous work: ${cause.message}`); }
  });
  if (journal) {
    hydrate();
    journal.addEventListener("input", () => { dirty = true; journalStatus.textContent = "Unsaved changes."; });
    document.getElementById("save-journal").addEventListener("click", saveJournal);
    document.getElementById("save-responses")?.addEventListener("click", saveJournal);
    document.querySelectorAll("[data-question]").forEach((input) => input.addEventListener("input", () => {
      dirty = true;
      const responseStatus = document.getElementById("responses-status");
      if (responseStatus) responseStatus.textContent = "Chưa lưu / Unsaved answers.";
    }));
    document.getElementById("complete-day").addEventListener("change", (event) => {
      state().completed = event.target.checked; saveJournal(); progress();
    });
  }
  window.addEventListener("beforeunload", (event) => {
    if (dirty || unbacked) { event.preventDefault(); event.returnValue = ""; }
  });
  document.getElementById("print-lesson")?.addEventListener("click", () => window.print());
  let opened = [];
  window.addEventListener("beforeprint", () => {
    opened = [...document.querySelectorAll("details:not([open])")];
    opened.forEach((node) => { node.open = true; });
    if (journal) {
      document.getElementById("print-journal")?.remove();
      const text = document.createElement("div");
      text.id = "print-journal"; text.className = "print-journal"; text.textContent = journal.value; journal.after(text);
    }
    document.querySelectorAll("[data-question]").forEach((input) => {
      input.parentElement.querySelector(".print-response")?.remove();
      const response = document.createElement("div");
      response.className = "print-response";
      response.textContent = input.value || "Chưa trả lời / No answer yet.";
      input.after(response);
    });
  });
  window.addEventListener("afterprint", () => {
    opened.forEach((node) => { node.open = false; });
    document.getElementById("print-journal")?.remove();
    document.querySelectorAll(".print-response").forEach((response) => response.remove());
  });
  globalThis.ElliottApp = { state, persist, saveJournal, download, error, status, day };
  progress();
})();
