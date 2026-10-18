import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { chapters, introduction, conclusion, validateChapters, pdfSource } from "../teaching/pdf-chapters.mjs";
import { roadmapPages, roadmapMarkdown, unitStructureMarkdown, chapterFile, quizRevision, escape } from "../scripts/build-roadmap.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root,path),"utf8");
const quiz = createRequire(import.meta.url)("../assets/chapter-quiz.js");

test("curriculum uses exactly the six PDF chapters, not thirty days or a new invented sequence", () => {
  validateChapters();
  assert.deepEqual(chapters.map((chapter) => chapter.title), [
    "ELLIOTT WAVE AT FIRST GLANCE","THE MOTIVE PHASE","THE CORRECTIVE PHASE",
    "ELLIOTT WAVE OPTIMIZATION","HOW TO TRADE WITH ELLIOTT WAVE","ELLIOTT WAVE APPLICATION IN REAL TRADES"
  ]);
  assert.deepEqual(chapters.map((chapter) => chapter.pages),[[9,12],[13,27],[28,56],[57,76],[77,90],[91,104]]);
  assert.deepEqual(chapters.map((chapter) => chapter.questions.length),[6,10,18,12,16,10]);
  assert.deepEqual(introduction.pages,[7,8]);
  assert.deepEqual(conclusion.pages,[105,105]);
  assert.equal(read("Roadmap.md"),roadmapMarkdown());
  assert.equal(read("Unit-structure.md"),unitStructureMarkdown);
  assert.equal((read("Roadmap.md").match(/^## Chương /gm) || []).length,6);
  assert.ok(!/^#### Day |^### Giai đoạn /m.test(read("Roadmap.md")));
});

test("chapter subsections follow the PDF's named order including all correction and trading groups", () => {
  const second = chapters[1].sections.map((item) => item.title);
  assert.deepEqual(second,["Impulsive","Extended","Diagonals — Leading Diagonals (5-3-5-3-5)","Diagonals — Ending Diagonal (3-3-3-3-3)"]);
  const correction = chapters[2].sections.map((item) => item.title).join("\n");
  for (const name of ["Zig-Zag","Regular Flat","Expanding Flat","Running Flat","Triangle","Double Three","Triple Three","Simple Trick"]) assert.ok(correction.includes(name));
  const policies = chapters[4].sections;
  assert.equal(policies.length,8);
  assert.ok(policies[0].title.includes("Conservative Trading Style"));
  assert.ok(policies[4].title.includes("Aggressive Trading Style"));
  assert.equal(chapters[5].sections.length,7);
});

test("all 72 MCQs have one correct option, explanation and evidence pages within their own chapter", () => {
  const prompts = new Set();
  let count = 0;
  for (const chapter of chapters) for (const question of chapter.questions) {
    assert.ok(!prompts.has(question.prompt));
    prompts.add(question.prompt);
    assert.ok(question.prompt.length > 20);
    assert.equal(question.options.length,3);
    assert.equal(new Set(question.options).size,3);
    assert.ok(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 3);
    assert.ok(question.explanation.length > 35);
    assert.ok(question.pages[0] >= chapter.pages[0] && question.pages[1] <= chapter.pages[1]);
    assert.ok(!/MT5|lot|XAUUSD|broker|schema|workbook/i.test(question.prompt));
    count++;
  }
  assert.equal(count,72);
  const flat = chapters[2].questions.find((item) => item.prompt.includes("ngoại lệ forex"));
  assert.match(flat.options[flat.correct],/90%.*78,6%/);
  assert.ok(chapters[5].questions.find((item) => item.prompt.includes("Riêng Example #5")));
});

test("generated HTML is deterministic, local links resolve and source images have chapter-scoped attribution", () => {
  const pages = roadmapPages();
  assert.equal(Object.keys(pages).length,9);
  const provenance = JSON.parse(read("units/source-figures/provenance.json"));
  assert.equal(provenance.sourceSha256,createHash("sha256").update(readFileSync(resolve(root,pdfSource))).digest("hex"));
  for (const [file,html] of Object.entries(pages)) {
    assert.equal(read(file),html,`${file}: rebuild required`);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length,new Set(ids).size);
    for (const [,target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^https?:/.test(target)) continue;
      const [path,fragment] = target.split("#");
      const linked = path ? resolve(root,dirname(file),path) : resolve(root,file);
      assert.ok(existsSync(linked),`${file}: missing ${target}`);
      if (fragment && linked.endsWith(".html")) {
        assert.ok(readFileSync(linked,"utf8").includes(`id="${fragment}"`),`${file}: missing ${target}`);
      }
    }
  }
  for (const chapter of chapters) {
    const html = read(`chapters/${chapterFile(chapter.id)}`);
    assert.equal((html.match(/class="chapter-question"/g) || []).length,chapter.questions.length);
    assert.equal((html.match(/type="radio"/g) || []).length,chapter.questions.length * 3);
    for (const section of chapter.sections) for (const id of section.figures) {
      const figure = provenance.figures.find((item) => item.id === id);
      assert.ok(figure.page >= chapter.pages[0] && figure.page <= chapter.pages[1]);
      assert.ok(html.includes(`Image ${figure.image}`));
      assert.ok(html.includes(`id="figure-${id}"`));
      const png = readFileSync(resolve(root,`units/source-figures/${id}.png`));
      assert.equal(createHash("sha256").update(png).digest("hex"),figure.sha256);
      assert.equal(png.readUInt32BE(16),figure.width);
      assert.equal(png.readUInt32BE(20),figure.height);
    }
  }
});

test("chapter pages are independent of old MT5 runtime and preserve original books/legacy course", () => {
  for (const chapter of chapters) {
    const html = read(`chapters/${chapterFile(chapter.id)}`);
    for (const unwanted of ["pdf-chart-data.js","core.js","app.js","chart-lab.js","pdf-practice.js","source-chart.js",'id="price-chart"','id="risk-calculator"',"data-day="]) assert.ok(!html.includes(unwanted));
    const json = html.match(/id="chapter-quiz-config" type="application\/json">([\s\S]*?)<\/script>/);
    const config = JSON.parse(json[1]);
    assert.equal(config.chapter,chapter.id);
    assert.equal(config.revision,quizRevision(chapter));
    assert.equal(config.dataset,"elliott-pdf-chapters-v1");
    assert.equal(config.questions.length,chapter.questions.length);
    config.questions.forEach((question,index) => {
      assert.ok(html.includes(escape(question.prompt)));
      assert.deepEqual(question.pages,chapter.questions[index].pages);
    });
  }
  for (const file of ["index-30day.html","roadmap-30day.md","README-30day.md","legacy-index.html","assets/pdf-chart-data.js"]) assert.ok(existsSync(resolve(root,file)));
  assert.match(read("index-30day.html"),/30 unit/);
});

test("grading handles correct, wrong and unanswered choices without success-shaped invalid inputs", () => {
  const questions = chapters[0].questions;
  const correct = questions.map((question) => question.correct);
  assert.ok(quiz.grade(questions,correct).every((result) => result.correct));
  const unanswered = quiz.grade(questions,questions.map(() => null));
  assert.ok(unanswered.every((result) => !result.correct && result.unanswered));
  const wrong = quiz.grade(questions,correct.map((value) => (value + 1) % 3));
  assert.ok(wrong.every((result) => !result.correct && !result.unanswered));
  for (const answers of [null,[],correct.map(() => -1),correct.map(() => "0"),correct.map(() => NaN),correct.map(() => 3)]) assert.throws(() => quiz.grade(questions,answers),/Invalid/);
});

test("chapter storage is versioned and rejects cross-chapter, stale or malformed responses", () => {
  const chapter = chapters[1];
  const config = { dataset:"elliott-pdf-chapters-v1",chapter:chapter.id,revision:quizRevision(chapter),questions:chapter.questions };
  const saved = { ...config,answers:chapter.questions.map((question) => question.correct) };
  assert.deepEqual(quiz.validateSaved(saved,config),saved.answers);
  for (const value of [
    null,{...saved,dataset:"xauusd-pdf-v1"},{...saved,chapter:3},{...saved,revision:"stale"},
    {...saved,answers:{}},{...saved,answers:[null]},{...saved,answers:chapter.questions.map(() => false)}
  ]) assert.throws(() => quiz.validateSaved(value,config));
});
