import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
const checklist = source.slice(source.indexOf("// Reference only:"));

test("reference checklist is fixed at bottom right with top-level visibility switches", () => {
  assert.match(checklist, /table\.new\(position\.bottom_right, 3, 22/);
  assert.match(checklist, /if barstate\.islast/);
  assert.doesNotMatch(checklist, /input\.|plot(?:shape)?\(|alertcondition\(/);
  assert.match(checklist, /REFERENCE ONLY \| No live score/);
  assert.match(checklist, /if barstate\.islast and showPullbackChecklist/);
  assert.match(checklist, /frame_width = showPullbackChecklist \? 1 : 0/);
  const topInputs = source.slice(0, source.indexOf('string G_DATA'));
  assert.match(topInputs, /showDashboard = input\.bool\(true, "Show market bias panel"/);
  assert.match(topInputs, /showPullbackChecklist = input\.bool\(true, "Show pullback checklist panel"/);
  assert.equal([...source.matchAll(/bool showDashboard =/g)].length, 1);
  const dashboardPosition = source.match(/^string panelPosition = (.*)$/m)[1];
  assert.doesNotMatch(dashboardPosition, /position\.bottom_right/);
});

test("all fourteen criteria fit their rows and retain the rubric points", () => {
  const arrays = Object.fromEntries(
    [...checklist.matchAll(/array<string> (checklist\w+) = array\.from\(([\s\S]*?)\)\n/g)]
      .map(([, name, content]) => [name, [...content.matchAll(/"([^"]*)"/g)].map(m => m[1])]),
  );
  for (const name of ["checklistGroups", "checklistRules", "checklistPoints", "checklistTips"]) {
    assert.equal(arrays[name].length, 14, name);
  }
  assert.deepEqual(arrays.checklistPoints, [
    "15 / 0", "10 / 5 / 0", "5 (3+) / 2 (2)", "5 / 0", "5 / 0",
    "10 / 0", "5 / 0", "8 / 0", "6 / 3 / 0", "6 / 0",
    "10 / 0", "8 / 0", "7 / 0", "+5",
  ]);
  assert.match(checklist, /for i = 0 to 13/);
  assert.match(checklist, /for row = 16 to 21/);
});

test("hard failures, score cap, grades and manual news verification are visible", () => {
  for (const text of [
    "HTF alignment = 0", "aggressive line breakdown", "RR < 1:2",
    "high-impact news +/-15 min", "min(100, category points + bonus)",
    "85-100 A+ | 70-84 A | 50-69 B | <50 Invalid",
    "Rubric minimum: 70", "News proximity is not evaluated",
  ]) {
    assert.ok(checklist.includes(text), text);
  }
});
