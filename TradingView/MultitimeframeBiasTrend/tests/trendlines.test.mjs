import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");

test("chart trendline drawings are removed without changing checklist rubric", () => {
  assert.doesNotMatch(source, /Draw trendlines|tlEnabled|f_luxPivots|f_luxDraw|TlBin|tlLabelPool/);
  assert.ok(source.includes("Trendline slope 30-45 degrees [5/0]"));
});
